import { ipcRenderer } from "electron"

console.log("loaded")

let checkExist = setInterval(() => {
    if (document.getElementById("topdiv")){
        console.log("ready")
        clearInterval(checkExist)
        ipcRenderer.send("reservation-popup-ready")
    }
}, 500);

ipcRenderer.on('here-is-info', (evt, payload)=> {
    let name = document.getElementById('nametd') as HTMLTableHeaderCellElement
    let vaccine = document.getElementById('vaccinetd') as HTMLTableDataCellElement
    name!.innerText = payload[0]
    vaccine!.innerText = payload[1]
})



ipcRenderer.on("console", (_, msg) => {
    let consolee = document.getElementById('bottomdiv') as HTMLDivElement
    if (consolee.innerHTML.length > 45000)
        consolee.innerHTML = "";
    consolee.innerHTML += msg + "\n"
    consolee.scrollTop = consolee.scrollHeight;
})