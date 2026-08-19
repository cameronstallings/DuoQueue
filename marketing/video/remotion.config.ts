import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./src/lib/webpack-override";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(90);
Config.setCodec("h264");
Config.overrideWebpackConfig(webpackOverride);
