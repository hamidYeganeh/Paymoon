import { config as base } from "./base.js";
import globals from "globals";
export const config = [...base, { languageOptions: { globals: globals.jest } }];
