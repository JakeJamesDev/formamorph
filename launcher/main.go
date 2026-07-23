// Formamorph Windows launcher (the Discord-style stub). It is the stable root exe the user runs and the only
// binary Windows SmartScreen ever judges; the real Electron app lives in `<root>/app` and is swapped in place
// on update, so updates never re-trigger SmartScreen. Data (`<root>/userdata`) + models (`<root>/models`)
// sit beside the root and are never touched by a swap.
//
// Two modes:
//   default          set FORMAMORPH_ROOT, launch <root>/app/Formamorph.exe, exit.
//   --apply-update   the app has quit and staged a payload in userdata/updates; wait for its files to
//                    unlock, extract the payload, swap app -> app.backup / app.new -> app, relaunch with
//                    --just-updated, and roll back if the new build crashes before signaling health.
package main

import (
	"archive/zip"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type pending struct {
	Version string `json:"version"`
	Zip     string `json:"zip"`
	Sha512  string `json:"sha512"`
}

func main() {
	root := exeDir()
	apply := false
	var passthrough []string
	for _, a := range os.Args[1:] {
		if a == "--apply-update" {
			apply = true
		} else {
			passthrough = append(passthrough, a)
		}
	}
	if apply {
		applyUpdate(root)
		return
	}
	launchApp(root, passthrough, false)
}

func exeDir() string {
	p, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(p)
}

func appExe(root string) string { return filepath.Join(root, "app", "Formamorph.exe") }

// launchApp starts the real app with FORMAMORPH_ROOT set (so it keeps its data/models beside the root) and
// returns the started command without waiting.
func launchApp(root string, args []string, justUpdated bool) *exec.Cmd {
	full := args
	if justUpdated {
		full = append([]string{"--just-updated"}, args...)
	}
	cmd := exec.Command(appExe(root), full...)
	cmd.Env = append(os.Environ(), "FORMAMORPH_ROOT="+root)
	cmd.Dir = root
	_ = cmd.Start()
	return cmd
}

func applyUpdate(root string) {
	appDir := filepath.Join(root, "app")
	backupDir := filepath.Join(root, "app.backup")
	newDir := filepath.Join(root, "app.new")
	updatesDir := filepath.Join(root, "userdata", "updates")

	p, err := readPending(updatesDir)
	if err != nil || p.Zip == "" {
		launchApp(root, nil, false)
		return
	}

	// Re-verify the staged zip against its recorded checksum before extracting. The Electron app verified it
	// at download time, but this runs later (after a full app quit), so a payload swapped on disk in between
	// would otherwise be trusted. Fail closed on a missing or mismatched hash: skip the update, launch as-is.
	if sum, sErr := sha512File(p.Zip); sErr != nil || p.Sha512 == "" || !strings.EqualFold(sum, p.Sha512) {
		launchApp(root, nil, false)
		return
	}

	// Extract to a clean staging dir first, so a failed extract never corrupts the live app.
	_ = os.RemoveAll(newDir)
	if err := unzip(p.Zip, newDir); err != nil {
		_ = os.RemoveAll(newDir)
		launchApp(root, nil, false)
		return
	}

	// Swap, keeping exactly one backup generation for rollback. The app quit before spawning us, but
	// shutdown may still be releasing file handles, so retry until they drop. This rename doubles as the
	// lock test: it's atomic, so a failure leaves the live app untouched.
	_ = os.RemoveAll(backupDir)
	if !renameRetry(appDir, backupDir, 60*time.Second) {
		_ = os.RemoveAll(newDir)
		launchApp(root, nil, false)
		return
	}
	if err := os.Rename(newDir, appDir); err != nil {
		_ = os.Rename(backupDir, appDir) // put the old one back
		launchApp(root, nil, false)
		return
	}

	// Launch the new build and watch for its health marker; roll back only if it crashes before signaling.
	marker := filepath.Join(updatesDir, "launch-ok")
	_ = os.Remove(marker)
	cmd := launchApp(root, nil, true)

	exited := make(chan struct{})
	go func() { _ = cmd.Wait(); close(exited) }()

	deadline := time.After(90 * time.Second)
	for {
		if fileExists(marker) {
			// Success: the new build is healthy, so the rollback window is over — drop app.backup (the next
			// update makes its own) and clear staging. Keeping it would double the install size on disk.
			_ = os.Remove(marker)
			_ = os.RemoveAll(backupDir)
			_ = os.Remove(p.Zip)
			_ = os.Remove(filepath.Join(updatesDir, "pending.json"))
			return
		}
		select {
		case <-exited:
			rollback(root, appDir, backupDir)
			return
		case <-deadline:
			// Running but never signaled (older build / very slow boot) — leave it rather than kill a live app.
			return
		case <-time.After(500 * time.Millisecond):
		}
	}
}

func rollback(root, appDir, backupDir string) {
	failedDir := filepath.Join(root, "app.failed")
	_ = os.RemoveAll(failedDir)
	if err := os.Rename(appDir, failedDir); err == nil {
		_ = os.Rename(backupDir, appDir)
	}
	launchApp(root, nil, false)
}

func readPending(dir string) (pending, error) {
	var p pending
	b, err := os.ReadFile(filepath.Join(dir, "pending.json"))
	if err != nil {
		return p, err
	}
	err = json.Unmarshal(b, &p)
	return p, err
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// sha512File returns the lowercase hex SHA-512 of a file, streamed so a multi-hundred-MB payload isn't
// buffered in memory.
func sha512File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha512.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// renameRetry retries a rename until it succeeds or the timeout expires, giving the exiting app time to
// release its file handles. Safe to retry: rename is atomic, so a failed attempt changes nothing.
func renameRetry(from, to string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for {
		if err := os.Rename(from, to); err == nil {
			return true
		}
		if time.Now().After(deadline) {
			return false
		}
		time.Sleep(500 * time.Millisecond)
	}
}

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	cleanDest := filepath.Clean(dest) + string(os.PathSeparator)
	for _, f := range r.File {
		fp := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(fp, cleanDest) { // zip-slip guard
			continue
		}
		if f.FileInfo().IsDir() {
			_ = os.MkdirAll(fp, 0o755)
			continue
		}
		if err := os.MkdirAll(filepath.Dir(fp), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(fp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o755)
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}
