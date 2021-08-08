import { ipcRenderer } from "electron"

/**
 * Disable window.alert on Electron Renderer
 * https://bleepcoder.com/electron/260011582/disable-confirm-alert-prompt-dialogs-from-iframes-completely
 * Thanks to demosphen200
 */
let script = document.createElement('script')
script.innerText = `window.alert = (msg) => {console.log(msg)}`
document.appendChild(script)
document.removeChild(script)

if (location.href == "https://vaccine-map.kakao.com/map2?v=1"){
    ipcRenderer.once("do-parse", ()=>{
        /**
         * checkExist
         * To wait some element is present at DOM
         */
        let checkExist = setInterval(()=>{
            if (document.getElementsByClassName("btn_refresh").length > 0) {
                // #region Instruction to bottom nav
                var left = document.querySelector("#preact_root > div > main > article > div > div.util_map > div > div.item_choice") as HTMLDivElement
                var info_div = document.createElement("div")
                var info = document.createElement("span")
                info.textContent= "원하는 지역이 화면에 꽉차게 이동 및 크기 조절 하고 오른쪽 새로고침 버튼을 눌러주세요" 
                info.style.fontSize = "14px"
                info.style.color = "white"
                info.style.fontWeight = "900"
                info_div.appendChild(info)
                info_div.style.position = "relative"
                info_div.style.lineHeight = "20px"
                info_div.style.float = "left"
                info_div.style.backgroundColor = "black"
                left.parentNode!.insertBefore(info_div, left.nextSibling)
                // #endregion
                // #region Add event to refresh button
                let btn : any = document.getElementsByClassName("btn_refresh")[0]
                btn.addEventListener("click", ()=> {
                    console.log("Refresh Clicked")
                    ipcRenderer.send("coordinates-provides")
                })
                // #endregion
                clearInterval(checkExist)
            }
        }, 500)
    })
    ipcRenderer.send("ready-to-parse");
}
