import {Config, Console, Paths} from "../utils";
import { VaccineType } from "../types";
import axios from 'axios';
import https from "https";
import sound from "sound-play";
import path from 'path';
import { WebContents } from "electron";

const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized : false
    })
})

const console = Console

let map_header = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=utf-8",
    "Origin": "https://vaccine-map.kakao.com",
    "Accept-Language": "en-us",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 9.4.2",
    "Referer": "https://vaccine-map.kakao.com/",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "Keep-Alive",
    "Keep-Alive": "timeout=5, max=1000"
}

let vaccine_header = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=utf-8",
    "Origin": "https://vaccine.kakao.com",
    "Accept-Language": "en-us",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 9.4.2",
    "Referer": "https://vaccine.kakao.com/",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "Keep-Alive",
    "Keep-Alive": "timeout=5, max=1000"
}

function load_user() : Promise<any> {
    return new Promise((resolve, reject)=> {
        instance.request({
            url : "https://vaccine.kakao.com/api/v1/user",
            method: "get",
            headers: {
                Cookie: `${Config.data.cookie!.name}=${Config.data.cookie!.value}`
            }
        })
        .then((res)=>{
            if (res.status == 200){
                const user = res.data.user
                const reservation = res.data.reservation
                switch (user.status){
                    case "NORMAL":
                        resolve(user.name)
                        break;
                    case "UNKNOWN":
                        reject("Unknown User, Try to reach to authorities.")
                        break;
                    case "REFUSED":
                        reject("You may miss your past reservation before. Cannot reserve.")
                        break;
                    case "ALREADY_RESERVED":
                    case "ALREADY_VACCINATED":
                        reject(`You are already reserved or vaccinated ${reservation}`)
                    default:
                        reject(`Unknown status code ${user.status}`)
                }
            }
        })
        .catch((err) => {
            reject(err);
        })
        .then(()=>{});
    })
}

let foundHospital : any | undefined;

async function find_vaccine(wc : WebContents, retry_term : number = 200) : Promise<any> {
    try{
        while (true){
            await (()=>{return new Promise(resolve => setTimeout(resolve, retry_term))})();
            const response = await instance.request({
                url : 'https://vaccine-map.kakao.com/api/v3/vaccine/left_count_by_coords',
                method : "POST",
                data : {
                    "bottomRight" : {
                        "x" : Config.data.bottomRight?.x,
                        "y" : Config.data.bottomRight?.y,
                    },
                    "onlyLeft" : false,
                    "order" : "count",
                    "topLeft": {
                        "x": Config.data.TopLeft?.x,
                        "y": Config.data.TopLeft?.y
                    }
                },
                headers: map_header
            })
            if (response.status == 200){
                const hospitals : Array<any> = response.data.organizations as Array<any>
                
                let needRetry = true;
                let printlines = "";
                for(var i = 0; i < hospitals.length; i++){
                    if (["CLOSED", "EXHAUSTED", "UNAVAILABLE"].indexOf(hospitals[i].status) != -1)
                        continue
                    let hospital = hospitals[i]
                    const name = (hospital.orgName as string).trimEnd().padEnd(30, " ")
                    const status = (hospital.status as string).trimEnd().padEnd(10, " ")
                    printlines += `<p>${name}- ${status} - ${hospital.leftCounts}\t - ${hospital.address}</p>`

                    if (hospitals[i].status == "AVAILABLE" || hospitals[i].leftCounts != 0){
                        foundHospital = hospitals[i]
                        needRetry = false
                        break
                    }
                }
                console.log(wc, printlines);
                if (!foundHospital){
                    console.event(wc, `[EVENT] Vaccine not found at ${new Date(Date.now()).toLocaleString()}`)
                } else
                    break
            }
            if (!foundHospital)
                return find_vaccine(wc)
            Config.setOrgCode(foundHospital.orgCode)
            console.log(wc, `${foundHospital.leftCounts} vaccines were found at ${foundHospital.orgName}`)
            console.log(wc, `Address is ${foundHospital.address}`)
            get_vaccine_count(foundHospital, wc)
        }
    } catch (err){
        throw err
    }
}

async function get_vaccine_count(hospital : any, wc? : WebContents){
    if (Config.data.type == VaccineType.ANY) {
        try{
            const header = {...vaccine_header, ...{"cookie" : `${Config.data.cookie!.name}=${Config.data.cookie!.value}`}}
            console.log(wc!, header)
            const orgData = await instance.request({
                url: `https://vaccine.kakao.com/api/v3/org/org_code/${Config.data.orgCode}`,
                headers: header
            })
            if (orgData.status == 200){
                (orgData.data.lefts as Array<any>).some(x => {
                    if (x.leftCount > 0){
                        console.log(wc!, `${x.vaccineName} : ${x.leftCount} EA`)
                        Config.setFoundType(x.vaccineCode)
                        return true // break
                    }
                    return false // continue
                })
            }
        } catch (err){
            throw err;
        }
    } else{
        Config.setFoundType(Config.data.type!)
    }
    if (!Config.data.foundType)
        startReservation(wc!)
    else
        find_vaccine(wc!)
}

async function startReservation(wc : WebContents){
    const header = {...vaccine_header, ...{"cookie" : `${Config.data.cookie!.name}=${Config.data.cookie!.value}`}}
    try{
        var response = await axios.request({
            url: "https://vaccine.kakao.com/api/v2/reservation",
            data: {
                "from" : "List",
                "vaccineCode" : Config.data.foundType,
                "orgCode" : Config.data.orgCode,
                "distance" : null
            },
            headers: header
        })
        if (response.status == 200){
            switch(response.data.code){
                case "NO_VACANCY":
                    console.event(wc!, "[FAILED] Vaccine is not available")
                    break
                case "TIMEOUT":
                    console.event(wc!, "[FAILED] TIMEOUT, retrty reservation")
                    startReservation(wc!)
                    break
                case "SUCCESS":
                    console.event(wc!, "[SUCCESS] Reservation was succeessful!")
                    let orgData = response.data.organization
                    console.log(wc!, `🏥${orgData.orgName}\n📞${orgData.phoneNumber}\n📢${orgData.address}`)
                    sound.play(path.resolve(Paths.assets,'tada.mp3'))
                    break
                default:
                    console.event(wc!, "[UNKNOWN] I don't know what is happened")
                    console.event(wc!, "Checkout message below and try to reach authorities")
                    console.log(response.data)
                    break
            }
        }
    } catch (err){
        throw err;
    }
}

export default {
    load_user,
    find_vaccine
}