import {Config, GUIConsole, Paths} from "../utils";
import { VaccineType } from "../types";
import axios from 'axios';
import https from "https";
import sound from "sound-play";
import path from 'path';
import { WebContents } from "electron";
import * as _ from 'lodash';

const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized : false
    })
})

const sleep = (ms : number) => new Promise((resolve)=>{setTimeout(resolve, ms)})
const UNAVAILABLE_STATE = ["CLOSED", "EXHAUSTED", "UNAVAILABLE"]

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
    })
}

let foundHospital : any | undefined;

async function find_vaccine(wc : WebContents, retry_term : number = 200) : Promise<any> {
    foundHospital = undefined;
    try{
        while (true){
            //#region REQUEST
            await sleep(retry_term);
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
            //#endregion

            //#region Handling Response
            if (response.status == 200){
                const hospitals : Array<any> = response.data.organizations as Array<any>
                
                let printlines = "";
                for(var i = 0; i < hospitals.length; i++){
                    if (_.indexOf(UNAVAILABLE_STATE, hospitals[i].stats)) continue
                    let hospital = hospitals[i]
                    const name = (hospital.orgName as string).trimEnd().padEnd(30, " ")
                    const status = (hospital.status as string).trimEnd().padEnd(10, " ")
                    printlines += `<p>${name}- ${status} - ${hospital.leftCounts}\t - ${hospital.address}</p>`

                    if (hospitals[i].status == "AVAILABLE" || hospitals[i].leftCounts != 0){
                        foundHospital = hospitals[i]
                        break
                    }
                }

                GUIConsole.log(wc, printlines);
                if (!foundHospital)
                    GUIConsole.event(wc, `[EVENT] Vaccine not found at ${new Date(Date.now()).toLocaleString()}`)
                else
                    break
            }
            //#endregion

            if (!foundHospital)
                return find_vaccine(wc)
            Config.setOrgCode(foundHospital.orgCode)
            GUIConsole.log(wc, `${foundHospital.leftCounts} vaccines were found at ${foundHospital.orgName}`)
            GUIConsole.log(wc, `Address is ${foundHospital.address}`)
            if (Config.data.type == VaccineType.ANY) get_vaccine_count(foundHospital, wc)
            else startReservation(wc, Config.data.type!)
        }
    } catch (err){
        throw err
    }
}

async function get_vaccine_count(hospital : any, wc : WebContents){
    try{
        //#region REQUEST
        const header = {...vaccine_header, ...{"cookie" : `${Config.data.cookie!.name}=${Config.data.cookie!.value}`}}
        const orgData = await instance.request({
            url: `https://vaccine.kakao.com/api/v3/org/org_code/${Config.data.orgCode}`,
            headers: header
        })
        //#endregion

        if (orgData.status == 200){
            let result : boolean = _.some(orgData.data.lefts, x => {
                if (x.leftCount > 0){
                    GUIConsole.log(wc, `${x.vaccineName} : ${x.leftCount} EA`)
                    startReservation(wc, x.vaccineCode)
                    return true // break
                }
                return false // continue
            })
            if (!result) find_vaccine(wc)
        }
    } catch (err){
        throw err;
    }
}

async function startReservation(wc : WebContents, type : VaccineType){
    const header = {...vaccine_header, ...{"cookie" : `${Config.data.cookie!.name}=${Config.data.cookie!.value}`}}
    try{
        var response = await axios.request({
            url: "https://vaccine.kakao.com/api/v2/reservation",
            data: {
                "from" : "List",
                "vaccineCode" : type,
                "orgCode" : Config.data.orgCode,
                "distance" : null
            },
            headers: header
        })
        if (response.status == 200){
            switch(response.data.code){
                case "NO_VACANCY":
                    GUIConsole.event(wc, "[FAILED] Vaccine is not available")
                    break
                case "TIMEOUT":
                    GUIConsole.event(wc, "[FAILED] TIMEOUT, retrty reservation")
                    startReservation(wc, type)
                    break
                case "SUCCESS":
                    GUIConsole.event(wc, "[SUCCESS] Reservation was succeessful!")
                    let orgData = response.data.organization
                    GUIConsole.log(wc, `<p>🏥${orgData.orgName}</p><p>📞${orgData.phoneNumber}</p><p>📢${orgData.address}</p>`)
                    sound.play(path.resolve(Paths.assets,'tada.mp3'))
                    break
                default:
                    GUIConsole.event(wc, "[UNKNOWN] I don't know what is happened")
                    GUIConsole.event(wc, "Checkout message below and try to reach authorities")
                    GUIConsole.log(response.data)
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