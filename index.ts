import { exception } from "console";
import { BrowserWindow, app, ipcMain , Session, BrowserView, OnBeforeRequestListenerDetails, WebContents} from "electron";
import {Config, Paths, Console} from './utils';
import {KakaoRequest} from "./kakao";
import {VaccineType} from "./types";
import sound from "sound-play";
import path from 'path';
const isDev = process.env.ELECTRON_ENV == "development";

let mainWindow : BrowserWindow;
let session : Session | undefined;

app.on("window-all-closed", () => app.quit());
app.on("ready", async () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        resizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            preload: path.resolve(`${Paths.utils}/preload.js`)
        }
    })
    mainWindow.setTitle("korean-covid-19-remaining-vaccine-for-dummies")
    mainWindow.webContents.on("did-finish-load", () =>{
        mainWindow.setTitle("korean-covid-19-remaining-vaccine-for-dummies")
    })
    session = mainWindow.webContents.session;
    await session.clearStorageData({storages: ["cookies"]})
    mainWindow.loadURL("https://accounts.kakao.com/login?continue=https%3A%2F%2Fvaccine-map.kakao.com%2Fmap2%3Fv%3D1");

    ipcMain.on("messages", (evt, msg)=>{
        if (isDev)
            console.log(msg);
    })

    ipcMain.on('ready-to-parse', async () => {
        try{
            let cookies = await session?.cookies.get({domain: ".kakao.com"})
            let cookie = cookies?.filter(obj => {return obj.name == "_kawlt"})[0]
            if (!cookie) throw exception
            Config.setCookie(cookie)
        } catch(e){
            app.quit();
        }
        if (mainWindow.webContents.getURL().indexOf("vaccine") != 1){
            mainWindow.webContents.send("do-parse");
        }
    })

    ipcMain.once('coordinates-provides', () => {
        const filter = {urls:["*://vaccine-map.kakao.com/api/v3/vaccine/left_count_by_coords"]}
        const listener = (details : OnBeforeRequestListenerDetails, cb) => {
            try{
                let postData = JSON.parse(details.uploadData[0].bytes.toString())
                if (postData && postData.bottomRight){
                    console.log("[EVENT] Coordinate parsing successful")
                    console.log(postData)
                    Config.setBottomRight(postData.bottomRight)
                    Config.setTopLeft(postData.topLeft)
                    createPopup()
                } else {
                    throw new exception("can't resolve coordinate api response")
                }
             } catch (err){
                 console.error(err)
             }
             cb({})
        }
        session?.webRequest.onBeforeRequest(filter, listener)
    })
})

function createPopup() {
    let popup : BrowserView | null = new BrowserView({
        webPreferences:{
            nodeIntegration: true,
            preload: path.resolve(`${Paths.utils}/popup.js`)
        }
    })
    mainWindow.setBrowserView(popup)
    popup.setBounds({x: 0, y: 0, width:800, height: 600})
    popup.setBackgroundColor("#00ffffff")
    popup.webContents.loadFile(path.resolve(`${Paths.statics}/vaccine.html`))
    mainWindow.webContents.send("popup-opened")
    ipcMain.once("popup-accepted", (evt, type)=>{
        Config.setVaccineType(type as VaccineType)
        mainWindow.setBrowserView(null)
        // Reservation Popup
        let reservationPopup : BrowserView | null = new BrowserView({
            webPreferences:{
                nodeIntegration: true,
                preload: path.resolve(`${Paths.utils}/reservation_preload.js`)
            }
        })
        mainWindow.setBrowserView(reservationPopup)
        reservationPopup!.webContents.loadFile(path.resolve(`${Paths.statics}/reservation.html`))
        reservationPopup!.setBounds({x:0, y:0, width: 800, height: 600})
        reservationPopup!.setBackgroundColor("#00ffffff")
        if (isDev) reservationPopup!.webContents.openDevTools()
        if(mainWindow.webContents.isDevToolsOpened())
            mainWindow.webContents.closeDevTools()

        init_kakao()
    })
}

async function init_kakao(){
    let reservationPopup = mainWindow.getBrowserView()
    let wc : WebContents = reservationPopup!.webContents;
    try{
        var userName = await KakaoRequest.load_user()
        Config.setUserName(userName)
        ipcMain.once("reservation-popup-ready", (evt) => {
            reservationPopup!.webContents.send('here-is-info', [
                Config.data.userName,
                Config.data.type
            ])
        })
        // do request
        sound.play(path.resolve(Paths.assets, 'start.mp3'))
        KakaoRequest.find_vaccine(wc)
    } catch (err){
        sound.play(path.resolve(Paths.assets, 'xylophon.mp3'))
        Console.error(wc!, err)
    }
}

export default {
    session
}