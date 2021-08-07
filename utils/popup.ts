import { ipcRenderer } from "electron"

let checkExist = setInterval(() => {
    if (location.href.indexOf("vaccine.html") != -1 && document.getElementById('accept')){
        let btn = document.getElementById('accept')
        btn?.addEventListener("click", () => {
            console.log("clicked")
            let radios : any = document.getElementsByName('vaccine')
            radios.forEach((radio : any) => {
                if (radio.checked)
                    ipcRenderer.send('popup-accepted', (radio.value))
            })
        })
        clearInterval(checkExist)
    }
}, 500)
