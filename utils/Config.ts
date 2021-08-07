import { Cookie } from "electron";
import { Coordinates, VaccineType } from "../types";

class Config{
    cookie : Cookie | undefined;
    bottomRight : Coordinates | undefined;
    TopLeft : Coordinates | undefined;
    type : VaccineType | undefined;
    userName : string | undefined;
    orgCode : number | undefined;
    foundType : VaccineType | undefined
}

let data : Config = new Config()

function setCookie(cookie : Cookie) : void {
    data!.cookie = cookie;
}
function setBottomRight(botRight? : Coordinates) : void {
    data!.bottomRight = botRight;
}

function setTopLeft(topLeft? : Coordinates) : void {
    data!.TopLeft = topLeft;
}

function setVaccineType(type : VaccineType) : void {
    data!.type = type;
}

function setUserName(userName : string) : void {
    data!.userName = userName;
}

function setOrgCode(orgCode : number) : void {
    data!.orgCode = orgCode;
}
function setFoundType(type : VaccineType) : void {
    data!.foundType = type;
}

export default{
    data,
    setCookie,
    setBottomRight,
    setTopLeft,
    setVaccineType,
    setUserName,
    setOrgCode,
    setFoundType
}