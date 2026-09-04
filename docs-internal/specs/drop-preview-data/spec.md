# Spec: Stop sending preview data on publish (client)

Status: ready-for-agent

Server side: the FormamorphServer repo, `docs-internal/specs/drop-preview-data/spec.md`. Build that first. This half can ship before or after it, because the server ignores the field either way, but building it second lets the change be checked against a live server.

## Problem Statement

Every publish and every listing update sends the thumbnail twice. Once as the thumbnail field, which the server saves as a file, and once again inside a preview object that also repeats the name and description. The server never reads the preview object. It stores it, strips it from every response, and now drops the column that held it.

For a world with a large animated thumbnail, that doubles a request that is already tens of megabytes. Nothing in the catalog, the detail view, or the editor reads the preview object back.

## Solution

The publish call sends the name, description, thumbnail, content, kind, tags, and contest entry, and nothing else. The preview object goes away. Nothing the publisher or reader sees changes.

## User Stories

1. As a publisher, I want my publish request to carry my thumbnail once, so that publishing a world with a large image is faster.
2. As a publisher, I want my listing update request to carry my thumbnail once, so that saving edits is faster.
3. As a publisher, I want my listing to appear in the catalog with the same name, description, and thumbnail as before, so that nothing visible changes.
4. As a publisher, I want publishing into a contest to keep working, so that the request shape change does not touch the contest entry field.
5. As a publisher of a character or a book, I want publishing to keep working for every kind, so that the change is not world-only.
6. As a reader, I want catalog cards and thumbnails to look exactly as before, so that the change is invisible.
7. As a developer, I want the publish test to assert the preview object is absent, so that it cannot creep back in.
8. As a developer, I want the comment that explained the preview object removed with it, so that the code does not describe a field that no longer exists.
9. As a developer, I want the publish path to have one place that builds the request body, so that the removal is one change.

## Implementation Decisions

**Vocabulary.** A *listing* is a published item on the server, of any kind. The *publish call* is the one storage service method that creates or updates a listing over HTTP. The *preview object* is the request field being removed.

**Publish call.** The storage service's publish method stops building the preview object and stops including it in the request body. Every other field in the body stays as it is, in the same order. The comment that explained the preview object is removed with it.

**No compatibility flag.** The server accepts a body with or without the field, so there is no need to detect the server version or keep the old shape behind a switch.

**Nothing else reads it.** The catalog, detail view, editor, and local storage never held the preview object. Only the request body changes.

## Testing Decisions

**Seam.** The existing fetch-mock test on the storage service's publish method. Nothing new.

**What a good test looks like here.** It calls the publish method with a payload and asserts on the request the service made: the URL, the method, and the body fields. It does not inspect internals.

**Coverage to write.**

- The publish body carries name, description, thumbnail, content, kind, and tags, and no preview object. This replaces the test that asserted the preview object mirrored the list fields.
- The update path, with a target id, sends the same shape with no preview object.
- The contest entry field is still sent when given and still absent when not.

**Prior art.** The existing publish tests in the storage service test file, which mock fetch and read back the request body.

**Bar.** Coverage is measured, not guessed. The absence assertion is checked to fail when the preview object is put back. No scenario is shaped so a mechanic cannot fire.

## Out of Scope

- Changing how thumbnails are chosen, resized, or stored locally.
- Changing any other publish field.
- Any server change. That is the server half.

## Further Notes

The client can ship first without breaking anything. The server stores the preview object today only because the column exists, and the current server does not require the field.
