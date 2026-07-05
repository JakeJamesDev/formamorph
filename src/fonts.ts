// Self-hosted webfonts for the Font setting (Settings → Presentation). Bundled via Fontsource so the app
// works offline (desktop/Steam) with no Google CDN request. All @font-face rules carry a `unicode-range`,
// so declaring them here ships the files but the browser only DOWNLOADS a face when text actually uses it
// — i.e. only the selected font's Latin subset (non-Latin subsets load lazily if narration needs them).
// Variable faces (one file, all weights) where available; static faces are Latin-subset at the UI weights.

// Variable — normal (all weights) + italic axis.
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/inter/wght-italic.css';
import '@fontsource-variable/open-sans/index.css';
import '@fontsource-variable/open-sans/wght-italic.css';
import '@fontsource-variable/montserrat/index.css';
import '@fontsource-variable/montserrat/wght-italic.css';
import '@fontsource-variable/source-sans-3/index.css';
import '@fontsource-variable/source-sans-3/wght-italic.css';

// Static — Latin subset, the weights the UI uses (regular / medium / semibold / bold) + italics.
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/roboto/latin-400-italic.css';
import '@fontsource/roboto/latin-700-italic.css';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/lato/latin-400-italic.css';
import '@fontsource/lato/latin-700-italic.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-400-italic.css';
import '@fontsource/poppins/latin-700-italic.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import '@fontsource-variable/jetbrains-mono/wght-italic.css';

// Accessibility fonts (Settings → Accessibility): dyslexia (OpenDyslexic), low-vision (Atkinson
// Hyperlegible), reading-fluency (Lexend, variable), literacy (Andika). Latin subset, regular/bold + italic.
import '@fontsource-variable/lexend/index.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400-italic.css';
import '@fontsource/atkinson-hyperlegible/latin-700-italic.css';
import '@fontsource/andika/latin-400.css';
import '@fontsource/andika/latin-700.css';
import '@fontsource/andika/latin-400-italic.css';
import '@fontsource/andika/latin-700-italic.css';
import '@fontsource/opendyslexic/latin-400.css';
import '@fontsource/opendyslexic/latin-700.css';
import '@fontsource/opendyslexic/latin-400-italic.css';
import '@fontsource/opendyslexic/latin-700-italic.css';
