import { ipcRenderer } from "electron"

if (location.href == "https://vaccine-map.kakao.com/map2?v=1"){
    ipcRenderer.once("do-parse", ()=>{
        let checkExist = setInterval(()=>{
            if(document.getElementsByClassName("btn_refresh").length > 0){
                let btn : any = document.getElementsByClassName("btn_refresh")[0]
                btn.addEventListener("click", ()=> {
                    console.log("Refresh Clicked")
                    ipcRenderer.send("coordinates-provides")
                })
                clearInterval(checkExist)
            }
        }, 500)
    })
    ipcRenderer.send("ready-to-parse");
}
