// Studio and CLI settings. `npm run render` passes its own options to the renderer.
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
