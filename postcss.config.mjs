import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
  // Forzar resolución desde el directorio del proyecto
  from: path.resolve(__dirname, "src/app/globals.css"),
};

export default config;