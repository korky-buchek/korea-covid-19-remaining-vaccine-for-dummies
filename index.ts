import { exception } from "console";
import { BrowserWindow, app, ipcMain , Session, BrowserView, OnBeforeRequestListenerDetails, WebContents} from "electron";
import { Config, Paths, GUIConsole } from './utils';
import { KakaoRequest } from "./kakao";
import { VaccineType } from "./types";
import sound from "sound-play";
import path from 'path';
const isDev = process.env.ELECTRON_ENV == "development";

let mainWindow : BrowserWindow;
let wc : WebContents;
let session : Session;
let popup : BrowserView;
let reservationPopup : BrowserView;

const createViews = () => {
    popup = new BrowserView({
        webPreferences:{
            nodeIntegration: true,
            preload: path.resolve(`${Paths.preloads}/popup.js`)
        }
    })
    reservationPopup = new BrowserView({
        webPreferences:{
            nodeIntegration: true,
            preload: path.resolve(`${Paths.preloads}/reservation.js`)
        }
    })
}
const showPopup = () => {popup.setBounds({x: 0, y: 0, width:800, height: 600});popup.webContents.loadFile(path.resolve(`${Paths.statics}/vaccine.html`));wc.send("popup-opened")}
const showSelect = () => {reservationPopup.setBounds({x:0, y:0, width: 800, height: 600});reservationPopup.webContents.loadFile(path.resolve(`${Paths.statics}/reservation.html`))}

app.on("window-all-closed", () => app.quit())
app.on("ready", async () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title:"korean-covid-19-remaining-vaccine-for-dummies",
        resizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            preload: path.resolve(`${Paths.preloads}/map.js`)
        }
    })
    wc = mainWindow.webContents
    session = wc.session
    wc.on("did-finish-load", ()=>{mainWindow.setTitle("korean-covid-19-remaining-vaccine-for-dummies")})
    await session.clearStorageData({storages: ["cookies"]})
    mainWindow.loadURL("https://accounts.kakao.com/login?continue=https%3A%2F%2Fvaccine-map.kakao.com%2Fmap2%3Fv%3D1");
    createViews()
})

function createPopup() {
    mainWindow.setBrowserView(popup)
    showPopup()
}

async function init_kakao(){
    try{
        sound.play(path.resolve(Paths.assets, 'start.mp3'))
        KakaoRequest.find_vaccine(reservationPopup.webContents)
    } catch (err){
        sound.play(path.resolve(Paths.assets, 'xylophon.mp3'))
        GUIConsole.error(reservationPopup.webContents, err)
    }
}

// #region IPC between Renderer
ipcMain.on('ready-to-parse', async () => {
    try{
        let cookies = await session.cookies.get({domain: ".kakao.com"})
        let cookie = cookies?.filter(obj => {return obj.name == "_kawlt"})[0]
        if (!cookie) throw exception
        Config.setCookie(cookie)
        Config.setUserName(await KakaoRequest.load_user())
    } catch(e){
        app.quit();
    }
    if (wc.getURL().indexOf("vaccine") != 1){
        wc.send("do-parse");
    }
})

ipcMain.once("reservation-popup-ready", () => {
    reservationPopup.webContents.send('here-is-info', [
        Config.data.userName,
        Config.data.type
    ])
})

ipcMain.once("popup-accepted", (evt, type)=>{
    Config.setVaccineType(type as VaccineType)
    mainWindow.setBrowserView(null)
    mainWindow.setBrowserView(reservationPopup!)
    showSelect()
    if (isDev) reservationPopup.webContents.openDevTools()
    if (wc.isDevToolsOpened()) wc.closeDevTools()

    init_kakao()
})

ipcMain.once('coordinates-provides', () => {
    const filter = {urls:["*://vaccine-map.kakao.com/api/v3/vaccine/left_count_by_coords"]}
    const listener = (details : OnBeforeRequestListenerDetails, cb) => {
        try{
            let postData = JSON.parse(details.uploadData[0].bytes.toString())
            if (postData && postData.bottomRight){
                console.log("[EVENT] Coordinate parsing successful")
                Config.setBottomRight(postData.bottomRight)
                Config.setTopLeft(postData.topLeft)
                console.log(Config.data.bottomRight, Config.data.TopLeft)
                createPopup()
            } else {
                throw new exception("can't resolve coordinate api response")
            }
         } catch (err){
             console.error(err)
         }
         cb({})
    }
    session.webRequest.onBeforeRequest(filter, listener)
})
// #endregion
export default {

}