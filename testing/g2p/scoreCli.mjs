// Usage: node testing/g2p/scoreCli.mjs --predictions <word-to-phoneme.json> [--accent a|b] [--sets unknown,known,strange,fantasy] [--json <out>]
//        A TS pipeline runs under vite-node with --module <file whose default is async (word, accent) => phonemes>.
import { main } from "./score.mjs";

await main();
