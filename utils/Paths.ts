const isDev = process.env.ELECTRON_ENV == "development"

const utils = isDev ? "./build/utils" : `${process.resourcesPath}/build/utils`;
const sounds = isDev ? "./build/sounds" : `${process.resourcesPath}/sounds`;
const statics = isDev ? "./static" : `${process.resourcesPath}/static`;
const assets = isDev? "./assets" : `${process.resourcesPath}/assets`;

export default{
    utils,
    sounds,
    statics,
    assets
}