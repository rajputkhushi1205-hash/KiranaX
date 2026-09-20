import 'dotenv/config';
import { createApp } from './app.js';
const port = Number(process.env.PORT ?? 3000);
const app = createApp();
app.listen(port, () => {
    console.log(`KiranaX backend listening on http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map