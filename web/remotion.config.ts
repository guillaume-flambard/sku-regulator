import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("./remotion/index.tsx");
Config.setPublicDir("./remotion-public");
