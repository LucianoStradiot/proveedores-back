const cds = require('@sap/cds');
const { uuid } = require('@sap/audit-logging/lib/utils');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const { userId } = require('@sap-cloud-sdk/connectivity/dist/scp-cf');
const { cfenv } = require('cfenv');
const { axios } = require('axios');
const { qs } = require('qs');
const { request } = require("request");
const { results } = require('@sap/cds/lib/utils/cds-utils');
const { jwtDecode } = require('jwt-decode');
const { fileTypeFromBuffer } = require('file-type');
const { data } = require('@sap/cds/lib/dbs/cds-deploy');

module.exports = cds.service.impl(async function () {
    const db = await cds.connect.to("db");
    const schemaName = "PORTAL_PROVEEDORES";
    const FileType = await import('file-type');
    //let cliente_id = "CHANGEME_CLIENT_ID";
    let apprequest = "na";
    let mailrequest = "na";
    let daterequest = 0;
    let not_delete_message = "No fue posible eliminar el registro";
    let not_update_message = "No fue posible modificar el registro";
    let not_add_message = "No fue posible crear el registro";
    let delete_message = "El sistema eliminó correctamente un registro";
    let add_message = "El sistema agregó correctamente un nuevo registro";
    let update_message = "El sistema actualizó correctamente un registro";

    let setCookieBase = async (req) => {
        let { res } = req.http;
        try {
            let listCookies_ = await get_cookies(req);
            let listCookies = listCookies_.cookies;
            let environment = listCookies_.environment;
            let mail_request = "mail_request." + environment + ".ppc";
            let app_request = "app_request." + environment + ".ppc";
            let date_request = "date_request." + environment + ".ppc";
            let mr = listCookies[mail_request];
            let ar = listCookies[app_request];
            let dr = listCookies[date_request];
            let bufferMailRequest = Buffer.from(mr, 'base64');
            let bufferAppRequest = Buffer.from(ar, 'base64');
            let bufferDateRequest = Buffer.from(dr, 'base64');
            mailrequest = bufferMailRequest.toString('utf-8');
            apprequest = bufferAppRequest.toString('utf-8');
            daterequest = bufferDateRequest.toString('utf-8');
            let varSession = await getVarDurationSession();
            res.cookie(mail_request, mr, { maxAge: varSession, httpOnly: true, secure: true, session: true });
            res.cookie(app_request, ar, { maxAge: varSession, httpOnly: true, secure: true, session: true });
            res.cookie(date_request, dr, { maxAge: varSession, httpOnly: true, secure: true, session: true });
            return;
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método setCookieBase", detail: JSON.stringify(e) });
            return;
        }
    };

    let setLogSystem = async (param) => {
        let mail = mailrequest;
        let app_description = apprequest;
        let description_app = "";
        let asl = app_description.slice(0, 2);
        if (asl === "S_") {
            let queryS1 = `SELECT`;
            queryS1 += ` *`;
            queryS1 += ` FROM "` + schemaName + `"."DB_APPSMASTER" AS U`;
            queryS1 += ` WHERE U."APPID" = '` + app_description + `';`;
            let responseS1 = await db.run(queryS1);
            db.tx().commit();
            if (responseS1.length > 0) {
                description_app = responseS1[0].DESCRIPTION;
            }
        } else {
            description_app = await getNameMantenedor(app_description);
        }
        let date_request = Number(daterequest);
        let detail = param.detail.replaceAll("'", '\"');
        let sqlItems1 = `INSERT INTO "` + schemaName + `"."DB_SYSTEMLOG"("ID","CREATION_DATE","ACTION","LOCATION","DESCRIPTION","CREATION_USER","APP_DESCRIPTION","DETAIL","DELETESTATUS") `;
        sqlItems1 += `values('` + uuid().toString() + `', TO_DATE ('` + date_request + `')` + `,'` + param.action + `', '` + param.location + `', '` + param.description + `', '` + mail + `', '` + description_app + `', '` + detail + `', '1');`;

        try {
            let resultadoItems1 = await db.run(sqlItems1);
            return resultadoItems1 === 1 ? true : false;
        } catch (e) {
            throw new Error(e);
        }
    };

    let eliminaDuplicado = async (tuArreglo, atributodetuArreglo) => {
        var nuevoArreglo = [];
        var nuevoJson = {};

        for (var i in tuArreglo) {
            nuevoJson[tuArreglo[i][atributodetuArreglo]] = tuArreglo[i];
        }
        for (i in nuevoJson) {
            nuevoArreglo.push(nuevoJson[i]);
        }
        return nuevoArreglo;
    };

    let getNameMantenedor = async (keyApp) => {
        var retorno = "";

        switch (keyApp) {
            case "ADMIN_ACCIONES":
                retorno = "Administrador de acciones";
                break;
            case "ADMIN_APLICACIONES":
                retorno = "Administrador de aplicaciones";
                break;
            case "ADMIN_ESTADOS_USUARIO":
                retorno = "Administrador de estados de usuario";
                break;
            case "ADMIN_NOTIFICACIONES":
                retorno = "Administrador de notificaciones";
                break;
            case "ADMIN_PARAMETROS":
                retorno = "Administrador de parámetros";
                break;
            case "ADMIN_FAQ":
                retorno = "Administrador de preguntas frecuentes";
                break;
            case "ADMIN_ROLES":
                retorno = "Administrador de roles";
                break;
            case "ADMIN_TIPOS_USUARIO":
                retorno = "Administrador de tipos de usuarios";
                break;
            case "ADMIN_USUARIO":
                retorno = "Administrador de usuarios";
                break;
            case "ADMIN_MY_INBOX":
                retorno = "My Inbox HES";
                break;
            case "VALIDACION_PORTAL":
                retorno = "Validaciones inicio portal";
                break;
        }

        return retorno;
    };

    let addZero = async (sValue) => {
        if (sValue < 10) {
            sValue = "0" + sValue;
        }
        return sValue;
    };

    let validateSession = async (param, req) => {

        /*if (param.Postman !== undefined) {
            if (param.Postman === "SI") {
                return "OK";
            }
        }*/

        let validateCookies = await ValidateCookiesReq({ req: req, validate_token: true });
        if (validateCookies.resolve) {
            let tokenSession = validateCookies.token_session;
            if (tokenSession !== undefined) {
                let queryS1 = `SELECT`;
                queryS1 += ` *`;
                queryS1 += ` FROM "` + schemaName + `"."DB_SESSIONUSER" AS U`;
                queryS1 += ` WHERE U."ACCESSTOKEN" = '` + tokenSession + `';`;
                let responseS1 = await db.run(queryS1);
                db.tx().commit();

                if (responseS1.length > 0) {
                    if (responseS1[0].STATUS === '2') {
                        return "SESSION_LOGOUT";
                    }
                    param.Mail = responseS1[0].MAIL;
                    let queryS = `SELECT`;
                    queryS += ` U.SECRET`;
                    queryS += ` FROM "` + schemaName + `"."DB_USERSMASTER" AS U`;
                    queryS += ` WHERE U."EMAIL" = '` + param.Mail + `';`;
                    let responseS = await db.run(queryS);
                    db.tx().commit();

                    if (responseS.length > 0) {
                        const buff = Buffer.from(responseS[0].SECRET, "utf-8");
                        const cSecret = buff.toString();
                        let timeUpdate = new Date().getTime();
                        let timeCreate = Number(responseS1[0].TIMECREATE);
                        let optime = timeUpdate - timeCreate;
                        let varSession = await getVarDurationSession();
                        if (optime <= varSession) {
                            let deleteOtherSession = await onDeleteOtherSession(param);
                            let query1 = `SELECT COUNT(*) AS VALIDATION FROM "` + schemaName + `"."DB_SESSIONUSER" WHERE "ACCESSTOKEN" = '` + param.TokenSession + `' AND "MAIL" = '` + param.Mail + `';`;
                            let response1 = await db.run(query1);
                            db.tx().commit();
                            return (response1.length > 0 ? response1[0].VALIDATION > 0 ? "OK" : "Sin concidencias para TokenSession y Mail usuario" : "El token informado no pertenece al usuario conectado");
                        } else {
                            return "DURATION";
                        }
                    } else {
                        return "Usuario informado no existe en el sistema";
                    }
                } else {
                    return "No existe valor de tokenSession en el sistema";
                }
            } else {
                return "tokenSession undefined";
            }
        } else {
            return validateCookies.reason;
            //return "COOKIES" + " - " + JSON.stringify(validateCookies) + " - " + JSON.stringify(req.req.headers.cookie);
        }
    };

    let DeleteTokenBefore = async (email) => {
        let queryDelte = `DELETE FROM "` + schemaName + `"."DB_SESSIONUSER" WHERE "MAIL" = '` + email + `'`;
        let responseDelte = await db.run(queryDelte);
        db.tx().commit();
        return;
    };

    let getRegister = async (tableName, fieldId, id, fieldId2, id2) => {
        let retorno = [];
        let querySelect = `SELECT * FROM "` + schemaName + `"."` + tableName + `" WHERE "` + fieldId + `" = $1`;
        let responseSelect;
        if (fieldId2 !== undefined) {
            querySelect = `SELECT * FROM "` + schemaName + `"."` + tableName + `" WHERE "` + fieldId + `" = $1 AND "` + fieldId2 + `" = $2`;
            responseSelect = await db.run(querySelect, [id, id2]);
        } else {
            responseSelect = await db.run(querySelect, [id]);
        }
        db.tx().commit();
        if (responseSelect.length > 0) {
            retorno = responseSelect;
        }
        return retorno;
    };

    let getProveedorPortal = async (supplier) => {
        let retorno = false;
        let supp = supplier.padStart(10, "0");
        let querySelect = `SELECT DISTINCT(VENDORID) FROM "` + schemaName + `"."DB_USERSVENDORS" WHERE "VENDORID" = '` + supp + `'`;
        let responseSelect = await db.run(querySelect);
        db.tx().commit();
        if (responseSelect.length > 0) {
            retorno = true;
        }
        return retorno;
    };

    let onDeleteOtherSession = async (param) => {
        let querySelect = `SELECT NONCE FROM "` + schemaName + `"."DB_SESSIONUSER" WHERE "MAIL" = '` + param.Mail + `' AND "ACCESSTOKEN" = '` + param.TokenSession + `'`;
        let responseSelect = await db.run(querySelect);
        db.tx().commit();

        if (responseSelect.length > 0) {

            let functionRecorrer = async function (items, i) {
                if (items.length === i) {
                    return;
                } else {
                    let item = items[i];
                    let queryDelte = `DELETE FROM "` + schemaName + `"."DB_SESSIONUSER" WHERE "MAIL" = '` + param.Mail + `' AND "NONCE" = '` + item.NONCE + `' AND "ACCESSTOKEN" != '` + param.TokenSession + `' AND "STATUS" = '0'`;
                    let responseDelte = await db.run(queryDelte);
                    db.tx().commit();
                    i++;
                    await functionRecorrer(items, i);
                }
            };
            await functionRecorrer(responseSelect, 0);
        } else {
            return;
        }
    };

    let getTokenSessionForCookies = async (req) => {
        let retorno = "";
        let listCookies_ = await get_cookies(req);
        let listCookies = listCookies_.cookies;
        let cliente_id = listCookies_.client_id;
        let token_session = "token." + cliente_id + ".session";

        if (listCookies[token_session] !== undefined) {
            if (listCookies[token_session].length > 0) {
                retorno = listCookies[token_session];
            }
        }
        return retorno;
    };

    let getParamUserVendor = async (param, req) => {
        let jsonUser = {
            USERID: null,
            EMAIL: param.Mail,
            USERTYPE: "",
            USERSTATUS: "",
            FIRSTCHANGEPASS: 0,
            AUTH0ID: "",
            FIRSTCONDITIONS: 0,
            COUNT_VENDOR: 0,
            VENDORS: []
        };
        let isAdmin = false;
        let queryUserType = `SELECT U.USERTYPEID_USERTYPEID,U.USERSTATUSID_USERSTATUSID,U.USERTYPEID_USERTYPEID,U.FIRSTCHANGEPASS,U.USERID,U.AUTH0ID FROM "` + schemaName + `"."DB_USERSMASTER" AS U WHERE U."EMAIL" = '` + param.Mail + `';`;
        let response00 = await db.run(queryUserType);
        db.tx().commit();
        if (response00.length > 0) {
            let item00 = response00[0];
            let userId = item00.USERID;
            jsonUser.USERID = userId;
            jsonUser.USERSTATUS = item00.USERSTATUSID_USERSTATUSID;
            jsonUser.USERTYPE = item00.USERTYPEID_USERTYPEID;
            jsonUser.FIRSTCHANGEPASS = item00.FIRSTCHANGEPASS;
            jsonUser.AUTH0ID = item00.AUTH0ID;
            jsonUser.FIRSTCONDITIONS = 0;
            let query0 = "";
            if (item00.USERTYPEID_USERTYPEID === "01") {
                isAdmin = true;
                query0 = `SELECT DISTINCT(U.VENDORID) as VENDORID, 1 as FIRSTACCESS, 1 as DELETESTATUS_VENDOR FROM "` + schemaName + `"."DB_USERSVENDORS" AS U;`;
            } else if (item00.USERTYPEID_USERTYPEID === "02") {
                query0 = `SELECT`;
                query0 += ` V.VENDORID,V.FIRSTACCESS,V.DELETESTATUS AS DELETESTATUS_VENDOR`;
                query0 += ` FROM "` + schemaName + `"."DB_USERSMASTER" AS U`;
                query0 += ` INNER JOIN "` + schemaName + `"."DB_USERSVENDORS" AS V ON V.USERID_USERID = U.USERID`;
                query0 += ` WHERE U."EMAIL" = '` + param.Mail + `';`;

            } else {
                isAdmin = null;
            }

            if (isAdmin === null) {
                return jsonUser;
            }

            let response0 = await db.run(query0);
            db.tx().commit();

            if (response0.length > 0) {

                for (let i = 0; i < response0.length; i++) {
                    let item = response0[i];
                    let query1 = `SELECT COUNT(U.USERID_USERID) AS CANT`;
                    query1 += ` FROM "` + schemaName + `"."DB_TERMSANDCONDITIONSLOG" AS U`;
                    query1 += ` WHERE U."USERID_USERID" = ` + userId + `;`;
                    let response1 = await db.run(query1);
                    jsonUser.FIRSTCONDITIONS = response1.length > 0 ? response1[0].CANT : 0;
                    jsonUser.VENDORS.push({
                        "Supplier": item.VENDORID,
                        "FirstAccess": item.FIRSTACCESS,
                        "DeleteStatus": item.DELETESTATUS_VENDOR
                    });

                    if (response0.length === (i + 1)) {
                        jsonUser.COUNT_VENDOR = jsonUser.VENDORS.length;

                        if (isAdmin) {
                            jsonUser.COUNT_VENDOR = 0;
                            jsonUser.VENDORS = [];
                        }
                        return jsonUser;
                    }
                }
            } else {
                return jsonUser;
            }
        } else {
            return jsonUser;
        }

    };

    let get_cookies = async req => {
        let cookies = {};
        let client_id = "";
        let environment = "";
        let c = req.headers.cookie;
        c.split(';').forEach(function (cookie) {
            let parts = cookie.match(/(.*?)=(.*)$/);
            cookies[parts[1].trim()] = (parts[2] || '').trim();
            if (parts[1].trim().split(".")[2] === "is") {
                client_id = parts[1].trim().split(".")[1];
            }
            if (parts[1].trim().split(".")[2] === "ppc") {
                environment = parts[1].trim().split(".")[1];
            }
        });

        return { cookies: cookies, client_id: client_id, environment: environment };
    }

    let ValidateCookiesReq = async param => {
        let retorno = {
            resolve: false,
            legacy: null,
            auth0: null,
            token_session: null,
            listCookies: {},
            reason: "COOKIES"
            //extra: ""
        };
        try {
            let listCookies_ = await get_cookies(param.req);
            //retorno.extra += JSON.stringify(listCookies_);
            let listCookies = listCookies_.cookies;
            let cliente_id = listCookies_.client_id;
            retorno.listCookies = listCookies;
            let vad_legacy = "_legacy_auth0." + cliente_id + ".is.authenticated";
            let vad_auth0 = "auth0." + cliente_id + ".is.authenticated";
            let token_session = "token." + cliente_id + ".session";
            if (cliente_id !== "") {
                if (param.validate_token) {
                    //retorno.extra += " - PASÓ AQUÍ 0";
                    //retorno.extra += " - " + listCookies[vad_legacy] + " - " + listCookies[vad_auth0] + " - " + listCookies[token_session];
                    if (listCookies[vad_legacy] !== undefined && listCookies[vad_auth0] !== undefined && listCookies[token_session] !== undefined) {
                        //retorno.extra += " - PASÓ AQUÍ 1";
                        retorno.auth0 = listCookies[vad_auth0];
                        retorno.legacy = listCookies[vad_legacy];
                        retorno.token_session = listCookies[token_session];
                        if (listCookies[vad_legacy] === "true" && listCookies[vad_auth0] === "true" && listCookies[token_session].length > 0) {
                            //retorno.extra += " - PASÓ AQUÍ 2";
                            retorno.resolve = true;
                        }
                    }
                } else {
                    //retorno.extra += " - " + listCookies[vad_legacy] + " - " + listCookies[vad_auth0];
                    if (listCookies[vad_legacy] !== undefined && listCookies[vad_auth0] !== undefined) {
                        //retorno.extra += " - PASÓ AQUÍ 3";
                        retorno.auth0 = listCookies[vad_auth0];
                        retorno.legacy = listCookies[vad_legacy];
                        if (listCookies[vad_legacy] === "true" && listCookies[vad_auth0] === "true") {
                            //retorno.extra += " - PASÓ AQUÍ 4";
                            retorno.resolve = true;
                        }
                    }
                }
            } else {
                retorno.reason = "Sin cookies de auth0";
            }
            return retorno;
        } catch (e) {
            //retorno.extra += " - PASÓ AQUÍ 5";
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método ValidateCookiesReq", detail: JSON.stringify(JSON.stringify(retorno) + " - " + e) });
            return retorno;
        }
    };

    let updatePhoneNumber = async ({ phonenumber, supplier }) => {
        try {
            const srv = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');

            cds.env.features.fetch_csrf = true;

            const result = await srv.send({
                method: 'POST',
                path: "/vendorSet",
                data: {
                    "Supplier": supplier,
                    "Phonenumber": phonenumber
                }
            });

            return {
                resolve: true,
                data: result,
                message: ""
            };

        } catch (e) {
            return {
                resolve: false,
                data: {},
                message: JSON.stringify(e)
            };
        }
    };

    let getTokenECC = async param => {
        const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
        cds.env.features.fetch_csrf = true;
        const result = await PORTAL_PROVEEDORES.send({
            method: 'GET',
            path: "/SySet('')",
            headers: {
                'X-CSRF-Token': 'Fetch',
                'content-type': 'application/json'
            }
        });
        return result.headers.get('X-CSRF-Token');
    };

    let getValidatePhonenumber = async num => {
        let r = false;
        let retorno = num.replace(/[^0-9\_]/g, "");
        retorno = "+" + retorno;
        let v1 = /^(\+56)[0-9][987654321]\d{7}$/gm;
        if (num.length > 3 && num !== "0000000000") {
            if (v1.exec(retorno)) {
                r = true;
            }
        }
        return r;
    };

    let getValidatePassword = async pass => {
        let r = false;
        let visibleValidation = false;
        let validationOne = false;
        let validationTwo = false;
        let validationThree = false;
        let validationFour = false;
        let validationFive = false;

        let v1 = /[0-9]/g;
        let v2 = /([~!@#$%^&*()_+=?><.,/\]])/g;
        let v3 = /[A-Z]/g;
        let v4 = /\S{10,}$/g;
        let v5 = /[a-z]/g;
        let ps = /^((?=.*[~!@#$%^&*()_+=?><.,/\]])(?=.*[A-Z])(?=.*[0-9])(?=.*[a-z]))\S{10,}$/g;


        if (pass.length > 0) {
            visibleValidation = true;

            if (v1.exec(pass)) {
                validationOne = true;
            }
            if (v2.exec(pass)) {
                validationTwo = true;
            }

            if (v3.exec(pass)) {
                validationThree = true;
            }
            if (v4.exec(pass)) {
                validationFour = true;
            }
            if (v5.exec(pass)) {
                validationFive = true;
            }

            if (ps.exec(pass)) {
                validationOne = true;
                validationTwo = true;
                validationThree = true;
                validationFour = true;
                validationFive = true;
            }

            if (validationOne && validationTwo && validationThree && validationFour && validationFive) {
                r = true;
            }
        }
        return r;
    };

    let getVarDurationSession = async param => {
        let retorno = 600000;
        let queryS = `SELECT`;
        queryS += ` U.VALUE_VIEW`;
        queryS += ` FROM "` + schemaName + `"."DB_PARAMETERS" AS U`;
        queryS += ` WHERE U."KEY_VIEW" = 'SESSION_DURATION_IN_MILLISECONDS_PORTAL';`;
        let responseS = await db.run(queryS);
        db.tx().commit();

        if (responseS.length > 0) {
            retorno = Number(responseS[0].VALUE_VIEW);
        }
        return retorno;
    };

    let getRepresentantesPortal = async param => {
        try {
            let queryS = `SELECT`;
            queryS += ` UV.VENDORID, UE.DESCRIPTION, UM.USERID, UM.EMAIL, UM.AUTH0ID`;
            queryS += ` FROM "` + schemaName + `"."DB_USERSVENDORS" AS UV`;
            queryS += ` INNER JOIN "` + schemaName + `"."DB_USERSMASTER" AS UM ON UM.USERID = UV.USERID_USERID`;
            queryS += ` INNER JOIN "` + schemaName + `"."DB_USERSSTATUS" AS UE ON UM.USERSTATUSID_USERSTATUSID = UE.USERSTATUSID`;
            queryS += ` WHERE UM."USERTYPEID_USERTYPEID" = '02';`;
            let responseS = await db.run(queryS);
            db.tx().commit();
            return responseS;
        } catch (e) {
            return e;
        }

    };

    let getCountUserRol = async profileId => {
        let queryS = `SELECT`;
        queryS += ` U.USERID`;
        queryS += ` FROM "` + schemaName + `"."DB_USERSPROFILES" AS U`;
        queryS += ` WHERE U."PROFILEID" = '` + profileId + `'AND DELETESTATUS = '1';`;
        let responseS = await db.run(queryS);
        db.tx().commit();
        return responseS.length;
    };

    let getSupplierForSecret = async param => {
        let retorno = "";
        let tokenSession = param.TokenSession;

        if (tokenSession !== undefined) {
            let queryS1 = `SELECT`;
            queryS1 += ` *`;
            queryS1 += ` FROM "` + schemaName + `"."DB_SESSIONUSER" AS U`;
            queryS1 += ` WHERE U."ACCESSTOKEN" = '` + tokenSession + `';`;
            let responseS1 = await db.run(queryS1);
            db.tx().commit();
            if (responseS1.length > 0) {
                const supplier = responseS1[0].SUPPLIER;
                retorno = supplier;
                return retorno;
            }
        } else {
            return retorno;
        }
    };

    let getMailForSecret = async param => {
        let retorno = "";
        let tokenSession = param.TokenSession;

        if (tokenSession !== undefined) {
            let queryS1 = `SELECT`;
            queryS1 += ` *`;
            queryS1 += ` FROM "` + schemaName + `"."DB_SESSIONUSER" AS U`;
            queryS1 += ` WHERE U."ACCESSTOKEN" = '` + tokenSession + `';`;
            let responseS1 = await db.run(queryS1);
            db.tx().commit();
            if (responseS1.length > 0) {
                const email = responseS1[0].MAIL;
                retorno = email;
                return retorno;
            }
        } else {
            return retorno;
        }
    };

    let getUserIdForMail = async mail => {
        let retorno = "";
        if (mail !== undefined) {
            let queryS1 = `SELECT`;
            queryS1 += ` *`;
            queryS1 += ` FROM "` + schemaName + `"."DB_USERSMASTER" AS U`;
            queryS1 += ` WHERE U."EMAIL" = '` + mail + `';`;
            let responseS1 = await db.run(queryS1);
            db.tx().commit();

            if (responseS1.length > 0) {
                const useriId = responseS1[0].USERID;
                retorno = useriId;
            }
            return retorno;
        } else {
            return retorno;
        }
    };

    let getAuth0IdForMail = async mail => {
        let retorno = "";
        if (mail !== undefined) {
            let queryS1 = `SELECT`;
            queryS1 += ` *`;
            queryS1 += ` FROM "` + schemaName + `"."DB_USERSMASTER" AS U`;
            queryS1 += ` WHERE U."EMAIL" = '` + mail + `';`;
            let responseS1 = await db.run(queryS1);
            db.tx().commit();

            if (responseS1.length > 0) {
                const auth0Id = responseS1[0].AUTH0ID;
                retorno = auth0Id;
            }
            return retorno;
        } else {
            return retorno;
        }
    };

    let UpdateStatusUser = async param => {
        let retorno = false;
        if (param.mail !== undefined) {
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSMASTER" SET USERSTATUSID_USERSTATUSID = $2 WHERE "EMAIL" = $1;`;
            let responseUpdate = await db.run(queryUpdate, [param.email, param.status]);
            db.tx().commit();

            if (responseUpdate === 1) {
                retorno = true;
            }
            return retorno;
        } else {
            return retorno;
        }
    };

    let executeCallToken = async (options) => {
        var cfenv = require("cfenv");
        const qs = require('qs');
        const UAA_SERVICE = cfenv.getAppEnv().getService('PORTALPROVEEDORES_CAP-auth');
        const DESTINATION_SERVICE = cfenv.getAppEnv().getService('PORTALPROVEEDORES_CAP-destination');
        const UAA_CREDENTIALS = DESTINATION_SERVICE.credentials.clientid + ':' + DESTINATION_SERVICE.credentials.clientsecret;
        const DESTINATION_NAME = 'DESTINATION_AUTH0_TOKEN';

        const post_payload = {
            'client_id': DESTINATION_SERVICE.credentials.clientid,
            'grant_type': 'client_credentials'
        };

        const post_config = {
            method: 'POST',
            url: UAA_SERVICE.credentials.url + '/oauth/token',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(UAA_CREDENTIALS).toString('base64'),
                'Content-type': 'application/x-www-form-urlencoded'
            },
            data: new URLSearchParams(post_payload).toString()
        };

        async function fetchTokenMail() {
            let axios = require('axios');
            try {
                const response = await axios.request(post_config);
                if (response.status === 200) {
                    let token = response.data.access_token;
                    const get_config = {
                        method: 'GET',
                        url: DESTINATION_SERVICE.credentials.uri + '/destination-configuration/v1/destinations/' + DESTINATION_NAME,
                        headers: {
                            'Authorization': 'Bearer ' + token
                        }
                    };

                    async function fetchDestination() {
                        const destinationResponse = await axios.request(get_config);
                        let destinationData = {};

                        const DESTINATION = destinationResponse.data;
                        destinationData.tokenServiceURL = DESTINATION.destinationConfiguration.tokenServiceURL;
                        destinationData.clientId = DESTINATION.destinationConfiguration.clientId;
                        destinationData.clientSecret = DESTINATION.destinationConfiguration.clientSecret;

                        let u = DESTINATION.destinationConfiguration.URL + "oauth/token";
                        options.url = DESTINATION.destinationConfiguration.URL + "oauth/token";

                        let urlOnly = DESTINATION.destinationConfiguration.URL;
                        let data = {
                            grant_type: 'client_credentials',
                            client_id: destinationData.clientId,
                            audience: destinationData.tokenServiceURL,
                            client_secret: destinationData.clientSecret
                        };
                        options.data = JSON.stringify(data);
                        return {
                            data: data,
                            options: options,
                            urlOnly: urlOnly
                        };
                    };
                    return await fetchDestination();
                }
            } catch (e) {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método executeCallToken, obtención token", detail: JSON.stringify(e) });
                if (!axios.isCancel(e)) {
                    throw new Error(e);
                }
            }

        };
        let remoteData = await fetchTokenMail();

        try {
            return {
                options: remoteData.options,
                urlOnly: remoteData.urlOnly,
                data: remoteData.data
            };
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método executeCallToken", detail: JSON.stringify(e) });
            throw new Error(e);
        }
    };

    let resendVerificationEmailAuth0 = async (urlOnly, accessToken, param) => {
        const axios = require('axios');
        try {

            const response = await axios({
                method: 'post',
                url: `${urlOnly}api/v2/jobs/verification-email`,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                data: {
                    user_id: param.auth0id
                }
            });

            return {
                resolve: true,
                data: {
                    success: true,
                    jobId: response.data.id
                }
            };

        } catch (error) {

            const status = error.response?.status || 500;

            console.error("Error en resendVerificationEmailAuth0:", {
                status,
                message: error.message,
                data: error.response?.data
            });

            let message;

            switch (status) {
                case 400:
                    message = "Solicitud inválida";
                    break;
                case 401:
                    message = "No autorizado";
                    break;
                case 403:
                    message = "Acceso denegado";
                    break;
                case 404:
                    message = "Usuario no encontrado";
                    break;
                case 429:
                    message = "Demasiadas solicitudes";
                    break;
                default:
                    message = "Error al reenviar correo de verificación";
            }

            return {
                resolve: false,
                status,
                message
            };
        }
    };

    let updatePasswordAuth0 = async (urlOnly, accessToken, param) => {
        const axios = require('axios');

        try {
            const response = await axios({
                method: 'patch',
                url: `${urlOnly}api/v2/users/${param.auth0id}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                data: {
                    password: param.password
                }
            });

            return {
                resolve: true,
                data: {
                    success: true
                }
            };

        } catch (error) {
            const status = error.response?.status || 500;
            console.error("Error en updatePasswordAuth0:", {
                status: status,
                message: error.message
            });

            let message;
            switch (status) {
                case 400:
                    message = "Solicitud inválida al actualizar la contraseña";
                    break;
                case 401:
                    message = "No autorizado para actualizar la contraseña";
                    break;
                case 403:
                    message = "Acceso denegado";
                    break;
                case 404:
                    message = "Usuario no encontrado";
                    break;
                default:
                    message = "Error al actualizar la contraseña";
            }

            return {
                resolve: false,
                status: status,
                message: message
            };
        }
    };

    let editPassAuth0 = async (param) => {

        let responseAuth0 = await getAuth0();

        const axios = require('axios');
        const qs = require('qs');
        let data = qs.stringify({
            'grant_type': 'password',
            'username': param.Mail,
            'password': param.Password,
            'audience': responseAuth0.data_conn.audience,
            'scope': 'read:current_user',
            'client_id': responseAuth0.data_conn.client_id,
            'client_secret': responseAuth0.data_conn.client_secret
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: responseAuth0.urlOnly + 'oauth/token',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
            },
            data: data
        };

        try {
            let axios = require('axios');
            let response22 = await axios.request(config);
            let at = JSON.stringify(response22.data.access_token);
            return at.length > 5 ? true : false;
        } catch (e) {
            return false;
        }

    };

    let editAuth0 = async (urlOnly, accessToken, param) => {

        let data = JSON.stringify({
            "blocked": param.AUTH0_BLOCKED,
            "email": param.EMAIL.toLowerCase(),
            "nickname": param.EMAIL.toLowerCase(),
            "name": param.NAME_USER
        });

        if (param.CHANGE_EMAIL !== "") {
            data.verify_email = true;
        }

        let config = {
            method: 'patch',
            maxBodyLength: Infinity,
            url: urlOnly + 'api/v2/users/' + param.AUTH0ID,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + accessToken
            },
            data: data
        };
        try {
            let axios = require('axios');
            let response22 = await axios.request(config);
            return response22;
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método editAuth0", detail: JSON.stringify(e) });
            let message = await getMessageErrorAuth0(e.status);
            return { "message": message, "status": e.status };
        }

    };

    let addAuth0 = async (urlOnly, accessToken, param, user_name) => {

        let nick_name = param.EMAIL.split("@")[0];
        let firstTree = nick_name.slice(0, 3);
        let pass = "Portal." + firstTree.toLowerCase().padEnd(3, '0') + "*";

        let data = JSON.stringify({
            "email": param.EMAIL.toLowerCase(),
            "user_metadata": {},
            "blocked": false,
            "email_verified": false,
            "app_metadata": {},
            "name": param.NAME_USER,
            "nickname": param.EMAIL.toLowerCase(),
            "user_id": "",
            "connection": "Username-Password-Authentication",
            "password": pass,
            "verify_email": true,
            "username": user_name
        });
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: urlOnly + 'api/v2/users',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + accessToken
            },
            data: data
        };

        try {
            let axios = require('axios');
            let response22 = await axios.request(config);
            return response22;
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método addAuth0", detail: JSON.stringify(e) });
            let message = await getMessageErrorAuth0(e.status);
            return { "message": message, "status": e.status };
        }

    };

    let getMessageErrorAuth0 = async (errorCode) => {
        let message = "";
        switch (Number(errorCode)) {
            case 201:
                message = "User successfully created.";
                break;
            case 400:
                message = "Connection is disabled. - Connection does not exist. - Cannot set username for connection without requires_username. - Connection does not support user creation through the API. It must either be a database or passwordless connection. - Invalid request body. The message will vary depending on the cause.";
                break;
            case 401:
                message = "Invalid token. - Client is not global. - Invalid signature received for JSON Web Token validation.";
                break;
            case 403:
                message = "Insufficient scope, expected any of: create:users.";
                break;
            case 409:
                message = "User already exists.";
                break;
            case 429:
                message = "Too many requests. Check the X-RateLimit-Limit, X-RateLimit-Remaining and X-RateLimit-Reset headers.";
                break;
            case 500:
                message = "Internal Server Error";
                break;
        }
        return message;
    };

    let getAuth0 = async param => {
        let config = {
            method: 'post',
            url: "",
            maxBodyLength: Infinity,
            headers: { 'content-type': 'application/json' },
            data: ""
        };
        let conn = await executeCallToken(config);

        try {
            let axios = require('axios');
            let response22 = await axios.request(conn.options);
            return {
                data: response22.data,
                urlOnly: conn.urlOnly,
                data_conn: conn.data
            };
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método getAuth0", detail: JSON.stringify(e) });
            if (!axios.isCancel(e)) {
                throw new Error(e);
            }
        }

    };

    let getAllDataUserAuth0 = async (accessToken, urlOnly) => {
        let arrayReturnUsers = [];
        let pageCount = 0;

        let functionRecorrerPage = async function (page) {
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: urlOnly + `api/v2/users?page=${page}&per_page=100&include_totals=true`,
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + accessToken
                }
            };

            try {
                let axios = require('axios');
                let responseFinal = await axios.request(config);
                if (responseFinal.data.users.length > 0) {
                    if (responseFinal.data.total > 100) {
                        arrayReturnUsers.push(...responseFinal.data.users);
                        page++;
                        await functionRecorrerPage(page);
                    } else {
                        arrayReturnUsers.push(...responseFinal.data.users);
                        return arrayReturnUsers;
                    }
                } else {
                    return arrayReturnUsers;
                }
            } catch (e) {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método getAllDataUserAuth0", detail: JSON.stringify(e) });
                let message = await getMessageErrorAuth0(e.status);
                return { "message": message, "status": e.status };
            }

        };
        await functionRecorrerPage(pageCount);
        return arrayReturnUsers;
    };

    let getDataUserAuth0 = async (idUser, accessToken, urlOnly) => {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: urlOnly + 'api/v2/users/' + idUser,
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + accessToken
            }
        };

        try {
            let axios = require('axios');
            let responseFinal = await axios.request(config);
            let dt = responseFinal.data
            dt.resolve = true;
            return dt;
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método getDataUserAuth0", detail: JSON.stringify(e) });
            let message = await getMessageErrorAuth0(e.status);
            return { "message": message, "status": e.status, "resolve": false };
        }
    };

    let getLogAuth0 = async (mailUser, queryService) => {
        try {
            let responseAuth0 = await getAuth0();
            let tokenData = responseAuth0.data;
            let urlOnly = responseAuth0.urlOnly;
            if (tokenData.hasOwnProperty('access_token')) {
                let accessToken = tokenData.access_token;

                let query = "";

                if (!queryService.includes("q=")) {

                    if (queryService.length > 0) {
                        query += queryService + "&";
                    }

                    query += 'q=user_name:"' + mailUser + '"';

                } else {
                    query = queryService + ' AND user_name:"' + mailUser + '"';
                }

                query = query.replaceAll("'", '"');

                let encodedUrl = "?" + encodeURIComponent(query);

                encodedUrl = encodedUrl.replaceAll("%3D", "=");
                encodedUrl = encodedUrl.replaceAll("%26", "&");

                let config = {
                    method: 'get',
                    url: urlOnly + 'api/v2/logs' + encodedUrl,
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': 'Bearer ' + accessToken
                    }
                };

                try {
                    let axios = require('axios');
                    let responseFinal = await axios.request(config);
                    return {
                        data: responseFinal.data,
                        query: '/api/v2/logs' + encodedUrl
                    };
                } catch (e) {
                    return JSON.stringify(e);
                }
            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No token auth0"
                });
            }

        } catch (ee) {
            return JSON.stringify(ee);
        }

    };

    let processVendorUpdate = async ({ param, mail, supplier, requireCurrentPassword }) => {
        try {
            let phonenumber = param.Phonenumber || "";
            let password = param.Password || "";
            let currentPassword = param.CurrentPassword || "";

            let isChangingPhone = phonenumber.length > 0;
            let isChangingPassword = password.length > 0;

            if (requireCurrentPassword && (isChangingPhone || isChangingPassword)) {

                if (!currentPassword) {
                    return {
                        error: true,
                        status: 400,
                        message: "Debe ingresar la contraseña actual"
                    };
                }

                let isValidUser = await editPassAuth0({
                    Mail: mail,
                    Password: currentPassword
                });

                if (!isValidUser) {
                    return {
                        error: true,
                        status: 401,
                        message: "La contraseña actual es incorrecta"
                    };
                }
            }

            let responseAuth0, tokenData, urlOnly, auth0id;

            if (isChangingPassword) {
                let validatePassword = await getValidatePassword(password);

                if (!validatePassword) {
                    return {
                        error: true,
                        status: 400,
                        message: "Formato de contraseña inválido"
                    };
                }

                responseAuth0 = await getAuth0();
                tokenData = responseAuth0.data;
                urlOnly = responseAuth0.urlOnly;
                auth0id = await getAuth0IdForMail(mail);
            }

            if (isChangingPhone) {
                let validatePhonenumber = await getValidatePhonenumber(phonenumber);

                if (!validatePhonenumber) {
                    return {
                        error: true,
                        status: 400,
                        message: "Formato de teléfono inválido"
                    };
                }
            }

            let mensaje = "Los datos fueron actualizados correctamente";
            let mensajeError = "";

            if (isChangingPhone && isChangingPassword) {

                let updatePhonenumber = await updatePhoneNumber({ phonenumber, supplier });
                let updatePassword = await updatePasswordAuth0(
                    urlOnly,
                    tokenData.access_token,
                    { password, auth0id }
                );

                if (!updatePhonenumber.resolve) {
                    console.error("Error updatePhoneNumber:", updatePhonenumber.message);
                    mensajeError += "Error al actualizar el teléfono. ";
                }

                if (!updatePassword.resolve) {
                    console.error("Error updatePasswordAuth0:", updatePassword.message);
                    mensajeError += "Error al actualizar la contraseña.";
                }

                if (mensajeError) {
                    mensaje = "Algunos datos no se actualizaron correctamente";
                }

            } else if (isChangingPhone) {

                let updatePhonenumber = await updatePhoneNumber({ phonenumber, supplier });

                if (!updatePhonenumber.resolve) {
                    console.error("Error updatePhoneNumber:", updatePhonenumber.message);

                    return {
                        error: true,
                        status: 500,
                        message: "No fue posible actualizar el teléfono"
                    };
                }

                mensaje = "El teléfono fue actualizado correctamente";

            } else if (isChangingPassword) {

                let updatePassword = await updatePasswordAuth0(
                    urlOnly,
                    tokenData.access_token,
                    { password, auth0id }
                );

                if (!updatePassword.resolve) {
                    console.error("Error updatePasswordAuth0:", updatePassword.message);

                    return {
                        error: true,
                        status: 500,
                        message: "No fue posible actualizar la contraseña"
                    };
                }

                mensaje = "La contraseña fue actualizada correctamente";
            }

            return {
                error: false,
                data: { message: mensaje, mensajeError }
            };

        } catch (error) {
            console.error("Error en processVendorUpdate:", {
                message: error.message,
                stack: error.stack
            });

            return {
                error: true,
                status: 500,
                message: "Error interno al procesar la solicitud"
            };
        }
    };

    this.on('gSySet', async req => {
        let { res } = req.http;
        try {
            const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
            const { SySet } = PORTAL_PROVEEDORES.entities;
            const result = await PORTAL_PROVEEDORES.run(
                SELECT.from(SySet)
                    .byKey({ Mandt: '' })
            );
            return result;

        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gVendorKeySet', async req => {
        let { res } = req.http;
        try {
            let param = req.data?.input;
            if (!param) {
                return res.status(400).json({ code: 400, message: "Input vacío" });
            }
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            let supplier = await getSupplierForSecret(param);
            let mail = await getMailForSecret(param);

            if (!supplier || supplier === "0000000000") {
                return res.status(400).json({ code: 302, message: "Supplier inválido" });
            }

            let validate = await validateSession(param, req);

            if (validate === "DURATION") {
                return res.status(400).json({
                    code: 305,
                    message: "Sesión expirada"
                });
            }

            if (validate !== "OK") {
                return res.status(400).json({
                    code: 303,
                    message: "Error validación sesión",
                    error: validate
                });
            }

            const srv = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
            const { vendorSet } = srv.entities;
            const result = await srv.run(
                SELECT.from(vendorSet).byKey({ Supplier: supplier })
            );

            if (!result) {
                return res.status(404).json({
                    code: 404,
                    message: "Proveedor no encontrado"
                });
            }

            let data_user = await SELECT.one.from('DB_USERSMASTER')
                .columns('USERID')
                .where({ EMAIL: mail });

            if (!data_user) {
                return res.status(400).json({
                    code: 301,
                    message: "Usuario no encontrado"
                });
            }

            let data_user_vendor = await SELECT.one.from('DB_USERSVENDORS')
                .columns('OFFICIALEMAIL')
                .where({
                    USERID_USERID: data_user.USERID,
                    VENDORID: supplier
                });

            result.OfficialEmailPortal = mail;

            if (data_user_vendor?.OFFICIALEMAIL) {
                result.OfficialEmailPortal = data_user_vendor.OFFICIALEMAIL;
            }

            return result;

        } catch (e) {
            return res.status(500).json({
                code: 500,
                message: e.message
            });
        }
    });

    this.on('gSessionUser', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        const tx = cds.transaction();
        try {
            let param = req.data.input;
            let supplier = param.Supplier;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Mail = await getMailForSecret(param);
            let mail = param.Mail;
            let userId = await getUserIdForMail(mail);

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gSessionUser, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {

                if ((supplier.length > 0 && supplier !== "0000000000") && mail.length) {

                    let queryS = `SELECT`;
                    queryS += ` *`;
                    queryS += ` FROM "` + schemaName + `"."DB_USERSVENDORS" AS U`;
                    queryS += ` WHERE U."USERID_USERID" = ` + userId + ` AND U."VENDORID" = '` + supplier + `' AND U."DELETESTATUS" = '1';`;
                    let responseS = await db.run(queryS);
                    db.tx().commit();
                    let countVal = responseS.length;

                    let queryUserType = `SELECT U.USERTYPEID_USERTYPEID FROM "` + schemaName + `"."DB_USERSMASTER" AS U WHERE U."EMAIL" = '` + param.Mail + `';`;
                    let response00 = await db.run(queryUserType);
                    db.tx().commit();
                    if (response00.length > 0) {
                        let item00 = response00[0];
                        if (item00.USERTYPEID_USERTYPEID === "01") {
                            countVal = 1;
                        }
                    }

                    if (countVal > 0) {
                        let queryUpdate = `UPDATE "` + schemaName + `"."DB_SESSIONUSER" SET SUPPLIER = $2,STATUS = $3 WHERE "ACCESSTOKEN" = $1;`;
                        let responseUpdate = await db.run(queryUpdate, [param.TokenSession, supplier, '1']);
                        db.tx().commit();
                        //let queryDelete = `DELETE FROM "` + schemaName + `"."DB_SESSIONUSER"  WHERE "SUPPLIER" IS NULL AND "ACCESSTOKEN" != $1 AND "STATUS" = $2`;
                        //let responseDelete = await db.run(queryDelete, [param.TokenSession, '0']);
                        //db.tx().commit();

                        /*return responseUpdate === 1 ? res.status(200).json({ message: "OK" }) : res.status(400).json({
                            code: 304,
                            message: "ERROR"
                        });*/
                        return res.status(200).json({ message: "OK" });
                    } else {
                        res.status(400).json({
                            code: 302,
                            message: "Error"
                        });
                    }
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gSessionUser, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gSessionUser", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('uLogout', async req => {
        let { res } = req.http;
        try {
            let tokenSession = await getTokenSessionForCookies(req);
            if (!tokenSession) {
                return res.status(200).json({
                    message: "OK"
                });
            }

            let queryUpdate = `
            UPDATE "${schemaName}"."DB_SESSIONUSER"
            SET STATUS = '2'
            WHERE ACCESSTOKEN = ?`;
            await db.run(queryUpdate, [tokenSession]);
            return res.status(200).json({
                message: "OK"
            });

        } catch (e) {
            return res.status(500).json({
                message: e.message
            });
        }
    });

    this.on('gPurcharseOrderSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            if (param.PurchaseorderdateI && param.PurchaseorderdateF) {
                const fechaI = param.PurchaseorderdateI;
                const fechaF = param.PurchaseorderdateF;

                if (typeof fechaI === "string" && fechaI.trim() !== "" && typeof fechaF === "string" && fechaF.trim() !== "") {
                    let fechaInicio = new Date(fechaI);
                    let fechaFin = new Date(fechaF);
                    const fechaMinima = new Date('2024-01-01');
                    if (fechaInicio < fechaMinima) {
                        return res.status(400).json({
                            code: 307,
                            message: "Solo se permiten consultas desde el 01-01-2024"
                        });
                    }
                    let fechaActual = new Date();
                    fechaActual = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0, 23, 59, 59);

                    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
                        return res.status(400).json({
                            code: 306,
                            message: "Formato de fecha inválido"
                        });
                    }

                    if (fechaFin > fechaActual) {
                        return res.status(400).json({
                            code: 307,
                            message: "No se permiten consultas posteriores al mes actual"
                        });
                    }

                    // Validar coherencia
                    if (fechaInicio > fechaFin) {
                        return res.status(400).json({
                            code: 308,
                            message: "La fecha inicial no puede ser mayor a la fecha final"
                        });
                    }
                }
            }
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderSet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (supplier.length > 0 && supplier !== "0000000000") {
                    let queryDynamic = `Supplier='` + supplier + `'`;

                    if (param.PurchaseorderdateI.length > 0 && param.PurchaseorderdateF.length > 0) {
                        queryDynamic += ` and Purchaseorderdate between '` + param.PurchaseorderdateI + `' and '` + param.PurchaseorderdateF + `'`;
                    }

                    if (param.Purchasingprocessingstatus.length > 0) {
                        queryDynamic += ` and Purchasingprocessingstatus='` + param.Purchasingprocessingstatus + `'`;
                    }

                    if (param.Companycode.length > 0) {
                        queryDynamic += ` and Companycode='` + param.Companycode + `'`;
                    }

                    if (param.Purchaseorder.length > 0) {
                        queryDynamic += ` and Purchaseorder='` + param.Purchaseorder + `'`;
                    }

                    const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                    const { purcharseOrderSet } = PORTAL_PROVEEDORES.entities;
                    const result = await PORTAL_PROVEEDORES.run(
                        SELECT.from(purcharseOrderSet, a => { a(), a.navPurOrdToItems(), a.navPurOrdToItems.navItemToHesItems() }).where(queryDynamic)
                    );
                    return result;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderSet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderSet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gSubposSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderSet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (param.Purchaseorder.length > 0 && param.Purchaseorderitem.length > 0) {
                    let query = `Purchaseorder='` + param.Purchaseorder + `' and Purchaseorderitem='` + param.Purchaseorderitem + `'`;

                    const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                    const { subposSet } = PORTAL_PROVEEDORES.entities;
                    const result = await PORTAL_PROVEEDORES.run(SELECT.from(subposSet).where(query));
                    return result;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderSet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderSet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gValidateSecretSession', async (req, ren) => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        let listCookies_ = await get_cookies(req);
        let listCookies = listCookies_.cookies;
        let cliente_id = listCookies_.client_id;
        let vad_legacy = "_legacy_auth0." + cliente_id + ".is.authenticated";
        let vad_auth0 = "auth0." + cliente_id + ".is.authenticated";
        let varSession = await getVarDurationSession();
        res.cookie(vad_legacy, listCookies[vad_legacy], { maxAge: varSession, httpOnly: true, secure: true, session: true });
        res.cookie(vad_auth0, listCookies[vad_auth0], { maxAge: varSession, httpOnly: true, secure: true, session: true });

        try {
            let param = req.data.input;
            let secret = param.Secret;
            if (secret.length > 0) {
                const decodeSecret = jwtDecode(secret);
                const nonce = decodeSecret.nonce;
                const email = decodeSecret.email;
                const sub = decodeSecret.sub;

                let queryS = `SELECT`;
                queryS += ` *`;
                queryS += ` FROM "` + schemaName + `"."DB_USERSMASTER" AS U`;
                queryS += ` WHERE U."EMAIL" = '` + email + `' AND U."AUTH0ID" = '` + sub + `';`;
                let responseS = await db.run(queryS);
                db.tx().commit();

                if (responseS.length > 0) {
                    let timeCreate = new Date().getTime();
                    let deleteTokenBefore = await DeleteTokenBefore(email);
                    let sqlItems1 = `INSERT INTO "` + schemaName + `"."DB_SESSIONUSER"(ACCESSTOKEN,SUPPLIER,MAIL,NONCE,TIMECREATE,STATUS) values($1,$2,$3,$4,$5,$6);`;
                    let params1 = [uuid().toString(), null, email, nonce, timeCreate.toString(), '0'];
                    try {
                        let resultadoItems1 = await db.run(sqlItems1, params1);
                        return resultadoItems1 === 1 ? res.status(200).json({ message: "OK", nonce: nonce, cookie: req.headers.cookie }) : res.status(400).json({
                            code: 304,
                            message: "ERROR JWT"
                        });
                    } catch (e) {
                        ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorSet", detail: JSON.stringify(e) });
                        throw new Error(e);
                    }

                } else {
                    return res.status(400).json({
                        code: 304,
                        message: "ERROR JWT"
                    });
                }
            } else {
                res.status(400).json({
                    code: 302,
                    message: "Falta campo clave para completar la solicitud"
                });
            }

        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gValidateSecretSession", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('uSecretSession', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);

        let listCookies_ = await get_cookies(req);
        let cliente_id = listCookies_.client_id;
        let token_session = "token." + cliente_id + ".session";
        try {
            let param = req.data.input;
            let secret = param.Secret;
            let nonceJwt = param.Nonce;
            if (secret.length > 0) {
                const decodeSecret = jwtDecode(secret);
                const nonce = decodeSecret.nonce;
                const email = decodeSecret.email;
                const sub = decodeSecret.sub;
                if (nonce === nonceJwt) {

                    let queryS = `SELECT`;
                    queryS += ` *`;
                    queryS += ` FROM "` + schemaName + `"."DB_SESSIONUSER" AS U`;
                    //queryS += ` WHERE U."MAIL" = '` + email + `' AND U."NONCE" = '` + nonceJwt + `' AND U."STATUS" = '0';`;
                    queryS += ` WHERE U."MAIL" = '` + email + `' AND U."NONCE" = '` + nonceJwt + `';`;
                    let responseS = await db.run(queryS);
                    db.tx().commit();

                    if (responseS.length > 0) {
                        let accessToken = responseS[0].ACCESSTOKEN;
                        let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSMASTER" SET SECRET = $3 WHERE "EMAIL" = $1 AND "AUTH0ID" = $2;`;
                        let responseUpdate = await db.run(queryUpdate, [email, sub, secret]);
                        db.tx().commit();
                        if (responseS[0].STATUS !== '0') {
                            let queryUpdate1 = `UPDATE "` + schemaName + `"."DB_SESSIONUSER" SET SUPPLIER = NULL, STATUS = $3 WHERE "MAIL" = $1 AND "NONCE" = $2;`;
                            let responseUpdate1 = await db.run(queryUpdate1, [email, nonceJwt, '0']);
                            db.tx().commit();
                        }

                        let responseAuth0 = await getAuth0();
                        let tokenData = responseAuth0.data;
                        let urlOnly = responseAuth0.urlOnly;
                        let responseFinal = await getDataUserAuth0(sub, tokenData.access_token, urlOnly);
                        let profile = {
                            email: responseFinal.email,
                            email_verified: responseFinal.email_verified,
                            sub: responseFinal.user_id,
                            name: responseFinal.name,
                            blocked: responseFinal.blocked,
                            last_login: responseFinal.last_login
                        }
                        let varSession = await getVarDurationSession();
                        res.cookie(token_session, accessToken, { maxAge: varSession, httpOnly: true, secure: true, session: true, sameSite: "Strict" });
                        return responseUpdate === 1 ? res.status(200).json({ message: "OK", AccessToken: accessToken, Profile: profile }) : res.status(400).json({
                            code: 304,
                            message: "ERROR"
                        });
                    } else {
                        res.status(400).json({
                            code: 302,
                            message: "Error en los datos de la estructura"
                        });
                    }
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Error en los datos de la estructura"
                    });
                }
            } else {
                res.status(400).json({
                    code: 302,
                    message: "Falta campo clave para completar la solicitud"
                });
            }

        } catch (e) {
            await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uSecretSession", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gCompanySet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gCompanySet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (supplier.length > 0 && supplier !== "0000000000") {
                    const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                    const { companySet } = PORTAL_PROVEEDORES.entities;
                    const result = await PORTAL_PROVEEDORES.run(
                        SELECT.from(companySet)
                            .where({ Supplier: supplier })
                    );
                    return result;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gCompanySet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gCompanySet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gPurchaseOrderStatusSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurchaseOrderStatusSet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (supplier.length > 0 && supplier !== "0000000000") {
                    const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                    const { PurchaseOrderStatusSet } = PORTAL_PROVEEDORES.entities;
                    const result = await PORTAL_PROVEEDORES.run(
                        SELECT.from(PurchaseOrderStatusSet)
                    );
                    return result;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurchaseOrderStatusSet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurchaseOrderStatusSet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gPurcharseOrderItemsSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderItemsSet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (supplier.length > 0 && supplier !== "0000000000") {
                    const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                    const { purcharseOrderItemsSet } = PORTAL_PROVEEDORES.entities;
                    const result = await PORTAL_PROVEEDORES.run(
                        SELECT.from(purcharseOrderItemsSet, a => { a(), a.navItemToHesItems() })
                            .where({ Purchaseorder: param.Purchaseorder })
                    );
                    return result;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderItemsSet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderItemsSet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });
    this.on('gAppmaster', async req => {
        //key appID,description,deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            //let deleteStatus = param.deleteStatus;
            let query = `SELECT`;
            query += ` U.APPID,U.DESCRIPTION,U.URL,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_APPSMASTER" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.APPID DESC;`;
            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('cAppmaster', async req => {
        //key appID,description,deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_APPSMASTER" (APPID,DESCRIPTION,URL,DELETESTATUS) VALUES ($1,$2,$3,$4)`;
            let responseInsert = await db.run(queryInsert, [param.APPID, param.DESCRIPTION, param.URL, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_add_message,
                data: {}
            };
            if (responseInsert === 1) {
                outMessage.code = 200;
                outMessage.message = add_message + " en la tabla DB_APPSMASTER";
                outMessage.data = await getRegister("DB_APPSMASTER", "APPID", param.APPID);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('gReportSystemLog', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let ge = param.CREATION_USER_GE;
            let le = param.CREATION_USER_LE;

            let querySelect = `SELECT`;
            querySelect += ` SL.ID,SL.CREATION_DATE,SL.ACTION,SL.LOCATION,SL.DESCRIPTION,SL.CREATION_USER,SL.APP_DESCRIPTION,SL.DETAIL,SL.DELETESTATUS,DS.DESCRIPTION AS DESCRIPTION_STATUSDELETE`;
            querySelect += ` FROM "` + schemaName + `"."DB_SYSTEMLOG" AS SL`;
            querySelect += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS DS ON SL.DELETESTATUS = DS.DELETESTATUS`;

            if (ge.length > 0 && le.length > 0) {
                querySelect += ` WHERE SL.CREATION_DATE BETWEEN '` + ge + `' AND '` + le + `'`;
            }
            querySelect += ` ORDER BY SL.CREATION_DATE DESC`;

            let responseSelect = await db.run(querySelect);
            db.tx().commit();
            try {
                responseSelect.forEach(function (element) {
                    element.DETAIL_TEXT = "";
                    try {
                        element.DETAIL_TEXT = element.DETAIL.toString('utf8');
                    } catch (eee) {
                        //
                    }
                });
            } catch (ee) {
                //
            }
            return responseSelect;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('uAppmaster', async req => {
        //key appID,description,deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_APPSMASTER" SET "URL" = $3, "DESCRIPTION" = $2, "DELETESTATUS" = $4 WHERE "APPID" = $1`;
            let responseUpdate = await db.run(queryUpdate, [param.APPID, param.DESCRIPTION, param.URL, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_update_message,
                data: {}
            };
            if (responseUpdate === 1) {
                outMessage.code = 200;
                outMessage.message = update_message + " en la tabla DB_APPSMASTER";
                outMessage.data = await getRegister("DB_APPSMASTER", "APPID", param.APPID);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('uOfficialEmail', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);

        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;
            let mail = await getMailForSecret(param);
            let officialEmail = param.OfficialEmail;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (supplier.length > 0 && supplier !== "0000000000") {


                    let data_user = await SELECT.one.from('DB_USERSMASTER')
                        .columns('USERID')
                        .where({ EMAIL: mail });

                    if (officialEmail === "1") {
                        let queryUpdate1 = `UPDATE "` + schemaName + `"."DB_USERSVENDORS" SET OFFICIALEMAIL = $1 WHERE "USERID_USERID" = $2 AND "VENDORID" = $3;`;
                        await db.run(queryUpdate1, [mail, data_user.USERID, supplier]);
                        db.tx().commit();
                    } else if (officialEmail === "2") {

                        const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                        const { vendorSet } = PORTAL_PROVEEDORES.entities;
                        const result = await PORTAL_PROVEEDORES.run(
                            SELECT.from(vendorSet)
                                .byKey({ Supplier: supplier })
                        );

                        if (result !== undefined) {
                            if (result.Supplier !== undefined) {
                                if (result.Supplier.length > 0) {
                                    let queryUpdate2 = `UPDATE "` + schemaName + `"."DB_USERSVENDORS" SET OFFICIALEMAIL = $1 WHERE "USERID_USERID" = $2 AND "VENDORID" = $3;`;
                                    await db.run(queryUpdate2, [result.Emailaddress, data_user.USERID, supplier]);
                                    db.tx().commit();
                                }
                            }
                        }
                    }

                    return res.status(200).json({
                        code: 200,
                        message: "OK"
                    });
                } else {
                    res.status(400).json({
                        code: 302,
                        message: ""
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorKeySet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }

        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorKeySet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('uInfoUser', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;
            let firstAccessPass = param.FirstAccessPass;
            let firstAccessPhone = param.FirstAccessPhone;
            let firstConditions = param.FirstConditions;
            let dateTimeFirstAccess = param.DateTimeFirstAccess;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uInfoUser, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if ((supplier.length > 0 && supplier !== "0000000000") && (dateTimeFirstAccess.length > 0) && (firstAccessPass === 0 || firstAccessPass === 1) && (firstAccessPhone === 0 || firstAccessPhone === 1) && (firstConditions === 0 || firstConditions === 1)) {

                    let querySelect1 = `SELECT U.USERID FROM "` + schemaName + `"."DB_USERSMASTER" AS U WHERE "EMAIL" = '` + param.Mail + `'`;
                    let responseSelect1 = await db.run(querySelect1);
                    db.tx().commit();

                    if (responseSelect1.length > 0) {
                        let userid = responseSelect1[0].USERID;

                        if (firstAccessPass === 1) {
                            let queryUpdate1 = `UPDATE "` + schemaName + `"."DB_USERSMASTER" SET FIRSTCHANGEPASS = 1,USERSTATUSID_USERSTATUSID = '02',DATEFIRSTCHANGEPASS = '` + dateTimeFirstAccess + `' WHERE "EMAIL" = '` + param.Mail + `'`;
                            let responseUpdate1 = await db.run(queryUpdate1);
                            db.tx().commit();
                        }

                        if (firstAccessPhone === 1) {
                            let queryUpdate2 = `UPDATE "` + schemaName + `"."DB_USERSVENDORS" SET FIRSTACCESS = 1, DATEFIRSTACCESS = '` + dateTimeFirstAccess + `' WHERE "VENDORID" = '` + param.Supplier + `' AND USERID_USERID = ` + userid;
                            let responseUpdate2 = await db.run(queryUpdate2);
                            db.tx().commit();
                        }

                        if (firstConditions === 1) {

                            let querySelect2 = `SELECT U.USERID_USERID FROM "` + schemaName + `"."DB_TERMSANDCONDITIONSLOG" AS U WHERE "USERID_USERID" = ` + userid + `;`;
                            let responseSelect2 = await db.run(querySelect2);
                            db.tx().commit();

                            if (responseSelect2.length === 0) {
                                let queryInsert = `INSERT INTO "` + schemaName + `"."DB_TERMSANDCONDITIONSLOG" ("ACCEPTANCEDATE", "USERID_USERID") VALUES ('` + dateTimeFirstAccess + `', ` + userid + `)`;
                                let responseInsert = await db.run(queryInsert);
                                db.tx().commit();
                            } else if (responseSelect2.length > 0) {
                                let queryUpdate = `UPDATE "` + schemaName + `"."DB_TERMSANDCONDITIONSLOG" SET ACCEPTANCEDATE = '` + dateTimeFirstAccess + `' WHERE "USERID_USERID" = ` + userid + `;`;
                                let responseUpdate = await db.run(queryUpdate);
                                db.tx().commit();
                            }


                        }
                    }
                    let result = await getParamUserVendor(param, req);
                    return result;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uInfoUser, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uInfoUser", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gInfoUser', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);

        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gInfoUser, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado",
                    validate: validate
                });
            }
            if (validate === "OK") {
                param.Mail = await getMailForSecret(param);
                let mail = param.Mail;

                if (mail.length > 0) {
                    let result = await getParamUserVendor(param, req);
                    delete result.AUTH0ID;
                    return result;
                } else {
                    res.status(400).json({
                        code: 303,
                        error: validate,
                        message: "No fue posible acceder a la información con los datos informados",
                        validate: validate
                    });
                }
            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados",
                    validate: validate
                });
            }
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gUserInfoPortal', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            param.Mail = await getMailForSecret(param);
            let mail = param.Mail;

            if (mail.length > 0) {
                let result = await getParamUserVendor(param, req);
                return result;
            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gUserInfoPortal", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gTokenAuth0', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let responseAuth0 = await getAuth0();
            let tokenData = responseAuth0.data;
            let urlOnly = responseAuth0.urlOnly;
            if (tokenData.hasOwnProperty('access_token')) {
                let output = {
                    ExpiresIn: tokenData.expires_in,
                    AccessToken: tokenData.access_token,
                    Url: urlOnly
                };
                return output;
            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No token auth0"
                });
            }
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gReportLogAuth0', async req => {
        let { res } = req.http;
        try {
            let output = [];
            let param = req.data.input;
            let queryService = param.QUERY_AUTH0;
            if (!queryService.includes("user_name:") && !queryService.includes("user_id:")) {
                let representantes = await getRepresentantesPortal();

                let functionRecorrer = async function (items, i) {
                    if (items.length === i) {
                        return output;
                    } else {
                        let item = items[i];
                        let mailUser = item.EMAIL;
                        let jsonData = {};
                        jsonData.ID_HANA = item.USERID;
                        jsonData.ID_AUTH0 = item.AUTH0ID;
                        jsonData.CODIGO_PROVEEDOR = item.VENDORID;
                        jsonData.CORREO = mailUser;
                        jsonData.ESTADO = item.DESCRIPTION;
                        jsonData.ULTIMA_CONEXION = null;

                        let responseFinal = await getLogAuth0(mailUser, queryService);
                        jsonData.LOGS_AUTH0 = responseFinal.data;
                        jsonData.QUERY = responseFinal.query;

                        if (responseFinal.data.length > 0) {
                            let af = responseFinal.data.filter(function (f) {
                                return f.type === "s";
                            });
                            jsonData.ULTIMA_CONEXION = af.length > 0 ? af[0].date : null
                        }

                        output.push(jsonData);
                        i++;
                        await functionRecorrer(items, i);
                    }
                };

                if (representantes.length > 0) {
                    await functionRecorrer(representantes, 0);
                }

                return output;

            } else {
                res.status(400).json({
                    code: 303,
                    message: "user_name/user_id filtro no permitido"
                });
            }
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gVendorWithLeastOneAccess', async req => {
        let { res } = req.http;
        try {
            let output = [];
            let representantes = await getRepresentantesPortal();

            let responseAuth0 = await getAuth0();
            let tokenData = responseAuth0.data;
            let urlOnly = responseAuth0.urlOnly;
            let accessToken = tokenData.access_token;
            let allUserAuth0 = await getAllDataUserAuth0(accessToken, urlOnly);

            let functionRecorrer = async function (items, i) {
                if (items.length === i) {
                    return output;
                } else {
                    let item = items[i];
                    let mailUser = item.EMAIL;
                    let idUser = item.AUTH0ID;
                    let jsonData = {};

                    jsonData.ID_HANA = item.USERID;
                    jsonData.ID_AUTH0 = idUser;
                    jsonData.CODIGO_PROVEEDOR = item.VENDORID;
                    jsonData.CORREO = mailUser;
                    jsonData.ESTADO = item.DESCRIPTION;
                    jsonData.CANTIDAD_DE_ACCESOS = 0;

                    let responseFinal = allUserAuth0.filter(function (ef) {
                        return ef.user_id === idUser;
                    });
                    //jsonData.DATA_AUTH0 = allUserAuth0;

                    if (responseFinal.length > 0) {
                        jsonData.CANTIDAD_DE_ACCESOS = responseFinal[0].logins_count
                    }

                    if (jsonData.CANTIDAD_DE_ACCESOS > 0) {
                        output.push(jsonData);
                    }

                    i++;
                    await functionRecorrer(items, i);
                }
            };

            if (representantes.length > 0) {
                await functionRecorrer(representantes, 0);
            }

            return output;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gVendorWithLeastOneAccessInTheLastMonth', async req => {
        let { res } = req.http;
        try {
            let output = [];
            let representantes = await getRepresentantesPortal();

            let responseAuth0 = await getAuth0();
            let tokenData = responseAuth0.data;
            let urlOnly = responseAuth0.urlOnly;
            let accessToken = tokenData.access_token;
            let allUserAuth0 = await getAllDataUserAuth0(accessToken, urlOnly);

            let functionRecorrer = async function (items, i) {
                if (items.length === i) {
                    return output;
                } else {
                    let item = items[i];
                    let mailUser = item.EMAIL;
                    let idUser = item.AUTH0ID;
                    let jsonData = {};

                    jsonData.ID_HANA = item.USERID;
                    jsonData.ID_AUTH0 = idUser;
                    jsonData.CODIGO_PROVEEDOR = item.VENDORID;
                    jsonData.CORREO = mailUser;
                    jsonData.ESTADO = item.DESCRIPTION;
                    jsonData.FECHA_ULTIMO_ACCESO = null;
                    jsonData.ACCESO_ULTIMOS_30D = false;
                    jsonData.ACCESO_MES_CURSO = false;

                    let responseFinal = allUserAuth0.filter(function (ef) {
                        return ef.user_id === idUser;
                    });
                    //jsonData.DATA_AUTH0 = allUserAuth0;

                    if (responseFinal.length > 0) {
                        jsonData.FECHA_ULTIMO_ACCESO = responseFinal[0].last_login
                    }

                    if (jsonData.FECHA_ULTIMO_ACCESO !== null) {
                        let f = new Date(jsonData.FECHA_ULTIMO_ACCESO);
                        let now = new Date();
                        let now_one = new Date(now.getFullYear(), now.getMonth(), 1);
                        if ((now.getTime() - f.getTime()) <= 2592000000) {
                            jsonData.ACCESO_ULTIMOS_30D = true;
                        }

                        if (f.getTime() >= now_one.getTime()) {
                            jsonData.ACCESO_MES_CURSO = true;
                        }
                        output.push(jsonData);
                    }

                    i++;
                    await functionRecorrer(items, i);
                }
            };

            if (representantes.length > 0) {
                await functionRecorrer(representantes, 0);
            }

            return output;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gInfoUserAuth0', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let idUser = param.IdUser;
            let accessToken = param.AccessToken;
            let urlOnly = param.Url;
            let responseFinal = await getDataUserAuth0(idUser, accessToken, urlOnly);
            return responseFinal;
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gInfoUserAuth0", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gVendorSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);

        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Mail = await getMailForSecret(param);
            let mail = param.Mail;

            if (mail.length > 0) {

                let dataUser = await getParamUserVendor(param, req);
                let result = [];
                if (dataUser.COUNT_VENDOR > 0) {

                    let functionRecorrer = async function (items, i) {
                        if (items.length === i) {
                            return result;
                        } else {
                            try {
                                let item = items[i];

                                //let supp = await addZero(item.Supplier, 10);
                                let supp = item.Supplier.padStart(10, "0");
                                let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                                let { vendorSet } = PORTAL_PROVEEDORES.entities;
                                let jsonResult = await PORTAL_PROVEEDORES.run(
                                    SELECT.from(vendorSet).byKey({ Supplier: supp })
                                );
                                jsonResult.FirstAccess = item.FirstAccess;
                                jsonResult.DeleteStatus = item.DeleteStatus;
                                if (jsonResult.Supplier !== undefined) {
                                    result.push(jsonResult);
                                }
                                i++;
                                await functionRecorrer(items, i);
                            } catch (e) {
                                //////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorSet, conexión OData", detail: JSON.stringify(e) });
                                result.push(e);
                                i++;
                                await functionRecorrer(items, i);
                            }
                        }
                    };
                    await functionRecorrer(dataUser.VENDORS, 0);
                    return result;
                } else {
                    return result;
                }
            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorSet", detail: JSON.stringify(e) });
            //res.status(e.code).json(e);
            throw new Error(e);
        }
    });

    this.on('gSolicitanteSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderItemsSet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                let purchaseorder = param.Purchaseorder;

                if (purchaseorder.length > 0) {
                    let queryDynamic = `Purchaseorder='` + purchaseorder + `'`;

                    let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                    let { solicitanteSet } = PORTAL_PROVEEDORES.entities;
                    let arrayResult = await PORTAL_PROVEEDORES.run(SELECT.from(solicitanteSet).where(queryDynamic));
                    return arrayResult;
                } else {
                    res.status(400).json({
                        code: 303,
                        error: validate,
                        message: "No fue posible acceder a la información con los datos informados"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderItemsSet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurcharseOrderItemsSet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gVendorSetSearchPortal', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let search = param.Search;

            if (search.length > 0) {
                let result = [];

                let queryDynamic = '';

                if (!isNaN(search)) {
                    queryDynamic = `Supplier='` + search + `'`;
                } else {
                    queryDynamic += `Supplierfullname='` + search + `'`;
                }

                let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                let { vendorSet } = PORTAL_PROVEEDORES.entities;
                let arrayResult = await PORTAL_PROVEEDORES.run(SELECT.from(vendorSet).where(queryDynamic));

                if (arrayResult.length > 0) {

                    let functionRecorrer = async function (items, i) {
                        if (items.length === i) {
                            return result;
                        } else {
                            try {
                                let item = items[i];
                                let supplier = item.Supplier;
                                let esProveedorPortal = await getProveedorPortal(supplier);
                                if (esProveedorPortal) {
                                    item.FirstAccess = 1;
                                    item.DeleteStatus = 1;
                                    result.push(item);
                                }
                                i++;
                                await functionRecorrer(items, i);
                            } catch (e) {
                                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorSetSearchPortal, conexión OData", detail: JSON.stringify(e) });
                                result.push(e);
                                i++;
                                await functionRecorrer(items, i);
                            }
                        }
                    };
                    await functionRecorrer(arrayResult, 0);
                    return result;
                } else {
                    return result;
                }
            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorSetPortal", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gVendorSetPortal', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let mail = param.Mail;

            if (mail.length > 0) {
                let dataUser = await getParamUserVendor(param, req);
                let result = [];
                if (dataUser.COUNT_VENDOR > 0) {

                    let functionRecorrer = async function (items, i) {
                        if (items.length === i) {
                            return result;
                        } else {
                            try {
                                let item = items[i];
                                let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                                let { vendorSet } = PORTAL_PROVEEDORES.entities;
                                let jsonResult = await PORTAL_PROVEEDORES.run(
                                    SELECT.from(vendorSet).byKey({ Supplier: item.Supplier })
                                );
                                jsonResult.FirstAccess = item.FirstAccess;
                                jsonResult.DeleteStatus = item.DeleteStatus;
                                result.push(jsonResult);
                                i++;
                                await functionRecorrer(items, i);
                            } catch (e) {
                                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorSetPortal, conexión OData", detail: JSON.stringify(e) });
                                result.push(e);
                                i++;
                                await functionRecorrer(items, i);
                            }
                        }
                    };
                    await functionRecorrer(dataUser.VENDORS, 0);
                    return result;
                } else {
                    return result;
                }
            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gPaymentsHeaderSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            if (param.CreationdateI && param.CreationdateF) {
                const fechaI = param.CreationdateI;
                const fechaF = param.CreationdateF;

                if (typeof fechaI === "string" && fechaI.trim() !== "" && typeof fechaF === "string" && fechaF.trim() !== "") {
                    let fechaInicio = new Date(fechaI);
                    let fechaFin = new Date(fechaF);
                    const fechaMinima = new Date('2024-01-01');
                    if (fechaInicio < fechaMinima) {
                        return res.status(400).json({
                            code: 307,
                            message: "Solo se permiten consultas desde el 01-01-2024"
                        });
                    }
                    let fechaActual = new Date();
                    fechaActual = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0, 23, 59, 59);

                    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
                        return res.status(400).json({
                            code: 306,
                            message: "Formato de fecha inválido"
                        });
                    }

                    if (fechaFin > fechaActual) {
                        return res.status(400).json({
                            code: 307,
                            message: "No se permiten consultas posteriores al mes actual"
                        });
                    }

                    // Validar coherencia
                    if (fechaInicio > fechaFin) {
                        return res.status(400).json({
                            code: 308,
                            message: "La fecha inicial no puede ser mayor a la fecha final"
                        });
                    }
                }
            }
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPaymentsHeaderSet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesión ha expirado"
                });
            }
            if (validate === "OK") {
                if (supplier.length > 0 && supplier !== "0000000000") {
                    let conditions = [];
                    if (param.CreationdateI.length > 0) {
                        conditions.push(`Creationdate>= '${param.CreationdateI}'`);
                    }
                    if (param.CreationdateF.length > 0) {
                        conditions.push(`Creationdate <= '${param.CreationdateF}'`);
                    }
                    if (supplier.length > 0 && supplier !== "0000000000") {
                        conditions.push(`Supplier='${supplier}'`);
                    }
                    if (param.Status.length > 0) {
                        conditions.push(`Status='${param.Status}'`);
                    }
                    if (param.Companycode.length > 0) {
                        conditions.push(`Companycode='${param.Companycode}'`);
                    }
                    if (param.Invoice.length > 0) {
                        conditions.push(`Invoice='${param.Invoice}'`);
                    }
                    if (param.Reference.length > 0) {
                        conditions.push(`Reference='${param.Reference}'`);
                    }
                    if (param.DocumentType.length > 0) {
                        conditions.push(`DocumentType='${param.DocumentType}'`);
                    }
                    let queryDynamic = conditions.length ? conditions.join(' and ') : "";

                    const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                    const { PaymentsHeaderSet } = PORTAL_PROVEEDORES.entities;
                    const result = await PORTAL_PROVEEDORES.run(SELECT.from(PaymentsHeaderSet).where(queryDynamic));
                    return result;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPaymentsHeaderSet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPaymentsHeaderSet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gGenericListInfoSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let type = param.Type;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gGenericListInfoSet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (type.length > 0) {
                    const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                    const { genericListInfoSet } = PORTAL_PROVEEDORES.entities;
                    const result = await PORTAL_PROVEEDORES.run(
                        SELECT.from(genericListInfoSet).where({ Type: type })
                    );
                    return result;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gGenericListInfoSet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gGenericListInfoSet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    // this.on('uVendorSet', async req => {
    //     let { res } = req.http;
    //     let cookieBase = await setCookieBase(req);
    //     try {
    //         let param = req.data.input;
    //         let phonenumber = param.Phonenumber;
    //         let password = param.Password;
    //         let tokenSession = await getTokenSessionForCookies(req);
    //         param.TokenSession = tokenSession;
    //         let validatePhonenumber = null;
    //         let validatePassword = null;

    //         let responseAuth0;
    //         let tokenData;
    //         let urlOnly;
    //         let auth0id;

    //         let validate = await validateSession(param, req);
    //         if (validate === "DURATION") {
    //             //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uVendorSet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
    //             res.status(400).json({
    //                 code: 305,
    //                 message: "El tiempo de la sesion ha expirado"
    //             });
    //         }
    //         let mail = await getMailForSecret(param);
    //         let supplier = await getSupplierForSecret(param);
    //         param.Mail = mail;
    //         param.Supplier = supplier;

    //         if (validate === "OK") {

    //             if (password.length > 0) {
    //                 validatePassword = await getValidatePassword(password);
    //                 if (!validatePassword) {
    //                     return res.status(400).json({
    //                         code: 304,
    //                         message: "Error en el formato de la contraseña informada"
    //                     });
    //                 } else {
    //                     responseAuth0 = await getAuth0();
    //                     tokenData = responseAuth0.data;
    //                     urlOnly = responseAuth0.urlOnly;
    //                     auth0id = await getAuth0IdForMail(mail);
    //                 }
    //             }

    //             if (phonenumber.length > 0) {
    //                 validatePhonenumber = await getValidatePhonenumber(phonenumber);
    //                 if (!validatePhonenumber) {
    //                     return res.status(400).json({
    //                         code: 304,
    //                         message: "Error en el formato del teléfono informado, Ej:+56XXXXXXXXX"
    //                     });
    //                 }
    //             }

    //             let mensaje = "Los datos fueron actualizados correctamente";
    //             let mensajeError = "";
    //             if (validatePhonenumber && validatePassword) {
    //                 //let updateStatusUser = await UpdateStatusUser({ mail: mail, status: "02" });
    //                 let updatePhonenumber1 = await updatePhoneNumber({ phonenumber: phonenumber, supplier: supplier });
    //                 let updatePassword1 = await updatePasswordAuth0(urlOnly, tokenData.access_token, { password: password, auth0id: auth0id });

    //                 if (!updatePhonenumber1 || !updatePassword1) {
    //                     mensaje = "Uno de los datos no fue actualizado correctamente: ";
    //                 }

    //                 if (!updatePhonenumber1.resolve) {
    //                     mensaje += "Teléfono ";
    //                     mensajeError += updatePhonenumber1.message + " ";
    //                 }

    //                 if (!updatePassword1.resolve) {
    //                     mensaje += "Contraseña";
    //                     mensajeError += updatePassword1.message;
    //                 }

    //                 return { message: mensaje, mensajeError: mensajeError };
    //             } else {
    //                 if (validatePhonenumber) {
    //                     mensaje = "El teléfono fue actualizado correctamente";
    //                     let updatePhonenumber2 = await updatePhoneNumber({ phonenumber: phonenumber, supplier: supplier });

    //                     if (!updatePhonenumber2.resolve) {
    //                         mensaje = "El teléfono no fue actualizado correctamente";
    //                         mensajeError += updatePhonenumber2.message;
    //                     } else {
    //                         //let updateStatusUser = await UpdateStatusUser({ mail: mail, status: "02" });
    //                     }

    //                 }

    //                 if (validatePassword) {
    //                     mensaje = "La contraseña fue actualizada correctamente";
    //                     let updatePassword2 = await updatePasswordAuth0(urlOnly, tokenData.access_token, { password: password, auth0id: auth0id });

    //                     if (!updatePassword2.resolve) {
    //                         mensaje = "La contraseña no fue actualizada correctamente";
    //                         mensajeError += updatePassword2.message;
    //                     } else {
    //                         //let updateStatusUser = await UpdateStatusUser({ mail: mail, status: "02" });
    //                     }
    //                 }
    //                 return { message: mensaje, mensajeError: mensajeError };
    //             }
    //         } else {
    //             //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPaymentsHeaderSet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
    //             res.status(400).json({
    //                 code: 303,
    //                 error: validate,
    //                 message: "No fue posible modificar la información con los datos informados"
    //             });
    //         }
    //     } catch (e) {
    //         //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uVendorSet", detail: JSON.stringify(e) });
    //         throw new Error(e);
    //     }
    // });

    this.on('uResendEmailVerification', async req => {
        const { res } = req.http;

        try {
            let param = req.data.input;

            if (!param.EMAIL || param.EMAIL.length === 0) {
                return res.status(400).json({
                    message: "El campo EMAIL es requerido para reenviar el correo de verificación"
                });
            }

            if (param.paramAuth0 !== undefined) {

                let paramAuth0 = param.paramAuth0;
                let accessToken = paramAuth0.AccessToken;
                let urlOnly = paramAuth0.Url;
                let mail = param.EMAIL;

                let auth0id = await getAuth0IdForMail(mail);
                if (auth0id.length === 0) {
                    return res.status(400).json({
                        message: "No se pudo obtener el ID de Auth0 para el correo proporcionado"
                    });
                }
                let resend = await resendVerificationEmailAuth0(urlOnly, accessToken, { auth0id });

                if (!resend.resolve) {
                    return res.status(400).json({
                        message: "No se pudo reenviar el correo de verificación"
                    });
                }

                return res.status(200).json({ message: "Correo de verificación reenviado correctamente" });
            } else {
                res.status(500).json({ message: "No fue posible editar el usuario." });
            }
        } catch (e) {
            console.error("Error en uResendEmailVerification:", {
                message: e.message,
                stack: e.stack
            });
            return res.status(500).json({
                message: "Error interno del servidor"
            });
        }
    });

    this.on('uVendorSet', async req => {
        const { res } = req.http;

        try {
            let param = req.data.input;

            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;

            let validate = await validateSession(param, req);

            if (validate !== "OK") {
                return res.status(400).json({
                    message: "Sesión inválida"
                });
            }

            let mail = await getMailForSecret(param);
            let supplier = await getSupplierForSecret(param);
            let data_user = await SELECT.one.from('DB_USERSMASTER').where({ EMAIL: mail });

            if (!data_user) {
                return res.status(400).json({ message: `El usuario no existe.` });
            }

            let data_check = await SELECT.from('DB_USERSVENDORS').where({ VENDORID: supplier, DELETESTATUS: "1", USERID_USERID: data_user.USERID });

            if (data_check.length === 0) {
                return res.status(400).json({ message: `No puedes modificar el ${supplier} ya que no lo tienes asignado.` });
            }

            let result = await processVendorUpdate({
                param,
                mail,
                supplier,
                requireCurrentPassword: true
            });

            if (result.error) {
                return res.status(result.status).json({
                    message: result.message
                });
            }

            return res.status(200).json(result.data);

        } catch (e) {
            console.error("Error en uVendorSet:", {
                message: e.message,
                stack: e.stack
            });
            return res.status(500).json({
                message: "Error interno del servidor"
            });
        }
    });

    this.on('uVendorSetFirstAccess', async req => {
        const { res } = req.http;

        try {
            let param = req.data.input;

            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;

            let validate = await validateSession(param, req);

            if (validate !== "OK") {
                return res.status(400).json({
                    message: "Sesión inválida"
                });
            }

            let mail = await getMailForSecret(param);
            let supplier = await getSupplierForSecret(param);

            let result = await processVendorUpdate({
                param,
                mail,
                supplier,
                requireCurrentPassword: false
            });

            if (result.error) {
                return res.status(result.status).json({
                    message: result.message
                });
            }

            return res.status(200).json(result.data);

        } catch (e) {
            console.error("Error en uVendorSetFirstAccess:", {
                message: e.message,
                stack: e.stack
            });

            return res.status(500).json({
                message: "Error interno del servidor"
            });
        }
    });

    this.on('gMovementsDates', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let purchaseOrder = param.PurchaseOrder;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gMovementsDates, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (purchaseOrder.length > 0) {
                    let query1 = `SELECT * FROM "` + schemaName + `"."DB_MOVEMENTSDATES" WHERE "PURCHASEORDER" = '` + purchaseOrder + `';`;
                    let response1 = await db.run(query1);
                    db.tx().commit();

                    return response1;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gMovementsDates, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gMovementsDates", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('uMovementsDates', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let purchaseOrder = param.PurchaseOrder;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uMovementsDates, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (purchaseOrder.length > 0) {
                    let query1 = `SELECT * FROM "` + schemaName + `"."DB_MOVEMENTSDATES" WHERE "PURCHASEORDER" = '` + purchaseOrder + `';`;
                    let response1 = await db.run(query1);
                    db.tx().commit();

                    return response1;
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uMovementsDates, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uMovementsDates", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gTermsAndConditionsLog', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let userId = param.userId;

            if (userId.length > 0) {
                let query1 = `SELECT * FROM "` + schemaName + `"."DB_TERMSANDCONDITIONSLOG" WHERE "USERID_USERID" = ` + userId + `;`;
                let response1 = await db.run(query1);
                db.tx().commit();

                return response1;
            } else {
                res.status(400).json({
                    code: 302,
                    message: "Falta campo clave para completar la solicitud"
                });
            }
        } catch (e) {
            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gTermsAndConditionsLog", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('uTermsAndConditionsLog', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let acceptanceDate = param.acceptanceDate;
            let userId = param.userId;
            if ((userId.length > 0 && userId !== "0000000")) {

                // Actualizar el registro existente
                let queryUpdate = `UPDATE "` + schemaName + `"."DB_TERMSANDCONDITIONSLOG" SET ACCEPTANCEDATE = '` + acceptanceDate + `' WHERE "USERID_USERID" = ` + userId + `;`;
                let responseUpdate = await db.run(queryUpdate);
                db.tx().commit();
                if (responseUpdate > 0) {
                    return responseUpdate;
                } else {
                    let queryInsert = `INSERT INTO "` + schemaName + `"."DB_TERMSANDCONDITIONSLOG" ("ACCEPTANCEDATE", "USERID_USERID") VALUES ('` + acceptanceDate + `', ` + userId + `)`;
                    let responseInsert = await db.run(queryInsert);
                    db.tx().commit();
                    return responseInsert;
                }

            } else {
                res.status(400).json({
                    code: 302,
                    message: "Falta campo clave para completar la solicitud"
                });
            }
        } catch (e) {
            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uTermsAndConditionsLog", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });
    this.on('gAccesstext', async req => {
        //key accessID,description,deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let query = `SELECT`;
            query += ` U.ACCESSID,U.DESCRIPTION,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_ACCESSTEXT" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.ACCESSID DESC;`;
            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('cAccesstext', async req => {
        //key accessID,description,deleteStatus
        let { res } = req.http;
        try {

            let queryId = `SELECT U.ACCESSID FROM "` + schemaName + `"."DB_ACCESSTEXT" AS U ORDER BY U.ACCESSID DESC`;
            let responseId = await db.run(queryId);
            let id = 1;

            if (responseId.length > 0) {
                id = (Number(responseId[0].ACCESSID) + 1).toString();
            }
            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_ACCESSTEXT" (ACCESSID,DESCRIPTION,DELETESTATUS) VALUES ($1,$2,$3)`;
            let responseInsert = await db.run(queryInsert, [id, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();
            let outMessage = {
                code: 400,
                message: not_add_message,
                data: {}
            };
            if (responseInsert === 1) {
                outMessage.code = 200;
                outMessage.message = add_message + " en la tabla DB_ACCESSTEXT";
                outMessage.data = await getRegister("DB_ACCESSTEXT", "ACCESSID", id);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('uAccesstext', async req => {
        //key accessID,description,deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_ACCESSTEXT" SET ACCESSID = $1, DESCRIPTION = $2, DELETESTATUS = $3 WHERE "ACCESSID" = $1`;
            let responseUpdate = await db.run(queryUpdate, [param.ACCESSID, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_update_message,
                data: {}
            };
            if (responseUpdate === 1) {
                outMessage.code = 200;
                outMessage.message = update_message + " en la tabla DB_ACCESSTEXT";
                outMessage.data = await getRegister("DB_ACCESSTEXT", "ACCESSID", param.ACCESSID);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('gUserstype', async req => {
        //key userTypeID,description,deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let query = `SELECT`;
            query += ` U.USERTYPEID,U.DESCRIPTION,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_USERSTYPE" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.USERTYPEID DESC;`;
            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('cUserstype', async req => {
        //key userTypeID,description,deleteStatus
        let { res } = req.http;
        try {
            let queryId = `SELECT U.USERTYPEID FROM "` + schemaName + `"."DB_USERSTYPE" AS U ORDER BY U.USERTYPEID DESC`;
            let responseId = await db.run(queryId);
            let appId = 1;
            if (responseId.length > 0) {
                appId = (Number(responseId[0].USERTYPEID) + 1).toString();
            }

            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_USERSTYPE" (USERTYPEID,DESCRIPTION,DELETESTATUS) VALUES ($1,$2,$3)`;
            let responseInsert = await db.run(queryInsert, [appId, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_add_message,
                data: {}
            };
            if (responseInsert === 1) {
                outMessage.code = 200;
                outMessage.message = add_message + " en la tabla DB_USERSTYPE";
                outMessage.data = await getRegister("DB_USERSTYPE", "USERTYPEID", appId);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('uUserstype', async req => {
        //key userTypeID,description,deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSTYPE" SET USERTYPEID = $1, DESCRIPTION = $2, DELETESTATUS = $3 WHERE "USERTYPEID" = $1`;
            let responseUpdate = await db.run(queryUpdate, [param.USERTYPEID, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_update_message,
                data: {}
            };
            if (responseUpdate === 1) {
                outMessage.code = 200;
                outMessage.message = update_message + " en la tabla DB_USERSTYPE";
                outMessage.data = await getRegister("DB_USERSTYPE", "USERTYPEID", param.USERTYPEID);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gUsersprofiles', async req => {
        //key userID integer,key profileID String(10),appID String(10) accessID String(2) deleteStatus 
        let { res } = req.http;
        try {
            let param = req.data.input;
            let query = `SELECT`;
            query += ` U.USERID,U.PROFILEID,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_USERSPROFILES" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.USERID DESC;`;
            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('cUsersprofiles', async req => {
        //key userID integer,key profileID String(10),appID String(10) accessID String(2) deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_USERSPROFILES" (USERID,PROFILEID,DELETESTATUS) VALUES ($1,$2,$3)`;
            let responseInsert = await db.run(queryInsert, [param.USERID, param.PROFILEID, param.DELETESTATUS]);
            db.tx().commit();
            return responseInsert;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('uUsersprofiles', async req => {
        //key userID integer,key profileID String(10),appID String(10) accessID String(2) deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSPROFILES" SET USERID = $1, PROFILEID = $2, DELETESTATUS = $3 WHERE "USERID" = $1 AND "PROFILEID" = $2`;
            let responseUpdate = await db.run(queryUpdate, [param.USERID, param.PROFILEID, param.DELETESTATUS]);
            db.tx().commit();
            return responseUpdate;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gUsersstatus', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let query = `SELECT`;
            query += ` U.USERSTATUSID,U.DESCRIPTION,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_USERSSTATUS" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.USERSTATUSID DESC;`;
            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('cUsersstatus', async req => {
        //key userStatusID,description,deleteStatus
        let { res } = req.http;
        try {

            let queryId = `SELECT U.USERSTATUSID FROM "` + schemaName + `"."DB_USERSSTATUS" AS U ORDER BY U.USERSTATUSID DESC`;
            let responseId = await db.run(queryId);
            let appId = 1;
            if (responseId.length > 0) {
                responseId.forEach(function (element) {
                    element.USERSTATUSID_n = Number(element.USERSTATUSID);
                });
            }
            responseId.sort((a, b) => b.USERSTATUSID_n - a.USERSTATUSID_n);

            appId = (responseId[0].USERSTATUSID_n + 1).toString();
            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_USERSSTATUS" (USERSTATUSID,DESCRIPTION,DELETESTATUS) VALUES ($1,$2,$3)`;
            let responseInsert = await db.run(queryInsert, [appId, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_add_message,
                data: {}
            };
            if (responseInsert === 1) {
                outMessage.code = 200;
                outMessage.message = add_message + " en la tabla DB_USERSSTATUS";
                outMessage.data = await getRegister("DB_USERSSTATUS", "USERSTATUSID", appId);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('uUsersstatus', async req => {
        //key userStatusID,description,deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSSTATUS" SET USERSTATUSID = $1, DESCRIPTION = $2, DELETESTATUS = $3 WHERE "USERSTATUSID" = $1`;
            let responseUpdate = await db.run(queryUpdate, [param.USERSTATUSID, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_update_message,
                data: {}
            };
            if (responseUpdate === 1) {
                outMessage.code = 200;
                outMessage.message = update_message + " en la tabla DB_USERSSTATUS";
                outMessage.data = await getRegister("DB_USERSSTATUS", "USERSTATUSID", param.USERSTATUSID);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('gVendorsPortal', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryWhere = "";
            if (param.Filters !== undefined) {
                let filter = param.Filters;
                if (filter.USERID > 0) {
                    queryWhere = " WHERE";
                    queryWhere += " U.USERID_USERID=" + filter.USERID;
                }
            }
            let query = `SELECT`;
            query += ` U.USERID_USERID,U.VENDORID,U.FIRSTACCESS,U.DATEFIRSTACCESS,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_USERSVENDORS" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_USERSMASTER" AS UM ON U.USERID_USERID = UM.USERID`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS `;
            query += queryWhere;
            query += ` ORDER BY U.USERID_USERID DESC;`;

            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('gVendorsActivePortal', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let query = `SELECT`;
            query += ` DISTINCT(U.VENDORID) AS VENDORID`;
            query += ` FROM "` + schemaName + `"."DB_USERSVENDORS" AS U`;

            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('gUsersvendors', async req => {
        //key userID integer key vendorID firstAccess dateFirstAccess deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryWhere = "";
            if (param.Filters !== undefined) {
                let filter = param.Filters;
                if (filter.USERID > 0) {
                    queryWhere = " WHERE";
                    queryWhere += " U.USERID_USERID=" + filter.USERID;
                }
            }
            let query = `SELECT`;
            query += ` U.USERID_USERID,U.VENDORID,U.FIRSTACCESS,U.DATEFIRSTACCESS,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_USERSVENDORS" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_USERSMASTER" AS UM ON U.USERID_USERID = UM.USERID`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS `;
            query += queryWhere;
            query += ` ORDER BY U.USERID_USERID DESC;`;

            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('cUserProfiles', async req => {
        //key userID key vendorID firstAccess dateFirstAccess deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_USERSPROFILES" (USERID,PROFILEID,DELETESTATUS) VALUES ($1,$2,$3)`;
            let responseInsert = await db.run(queryInsert, [param.USERID, param.PROFILEID, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_add_message,
                data: {}
            };
            if (responseInsert === 1) {
                outMessage.code = 200;
                outMessage.message = add_message + " en la tabla DB_USERSPROFILES";
                outMessage.data = await getRegister("DB_USERSPROFILES", "USERID", param.USERID, "PROFILEID", param.PROFILEID);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('cUsersvendors', async req => {
        //key userID key vendorID firstAccess dateFirstAccess deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_USERSVENDORS" (USERID_USERID,VENDORID,FIRSTACCESS,DATEFIRSTACCESS,DELETESTATUS) VALUES ($1,$2,$3,$4,$5)`;
            let responseInsert = await db.run(queryInsert, [param.USERID, param.VENDORID, param.FIRSTACCESS, param.DATEFIRSTACCESS, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_add_message,
                data: {}
            };
            if (responseInsert === 1) {
                outMessage.code = 200;
                outMessage.message = add_message + " en la tabla DB_USERSVENDORS";
                outMessage.data = await getRegister("DB_USERSVENDORS", "USERID_USERID", param.USERID, "VENDORID", param.VENDORID);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('uUsersvendors', async req => {
        //key userID key vendorID firstAccess dateFirstAccess deleteStatus
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSVENDORS" SET USERID_USERID = $1, VENDORID = $2, FIRSTACCESS = $3, DATEFIRSTACCESS = $4,  DELETESTATUS = $5 WHERE "USERID_USERID" = $1 AND VENDORID = $2`;
            let responseUpdate = await db.run(queryUpdate, [param.USERID, param.VENDORID, param.FIRSTACCESS, param.DATEFIRSTACCESS, param.DELETESTATUS]);
            db.tx().commit();
            return responseUpdate;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('dUsersvendors', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            const data_delete = await getRegister("DB_USERSVENDORS", "USERID_USERID", param.USERID, "VENDORID", param.VENDORID);
            let queryUpdate = `DELETE FROM "` + schemaName + `"."DB_USERSVENDORS" WHERE "USERID_USERID" = $1 AND VENDORID = $2`;
            let responseDelete = await db.run(queryUpdate, [param.USERID, param.VENDORID]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_delete_message,
                data: {}
            };
            if (responseDelete === 1) {
                outMessage.code = 200;
                outMessage.message = delete_message + " en la tabla DB_USERSVENDORS";
                outMessage.data = data_delete
            }
            return outMessage;

        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('dUserProfiles', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            const data_delete = await getRegister("DB_USERSPROFILES", "USERID", param.USERID, "PROFILEID", param.PROFILEID);
            let queryUpdate = `DELETE FROM "` + schemaName + `"."DB_USERSPROFILES" WHERE "USERID" = $1 AND PROFILEID = $2`;
            let responseDelete = await db.run(queryUpdate, [param.USERID, param.PROFILEID]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_delete_message,
                data: {}
            };
            if (responseDelete === 1) {
                outMessage.code = 200;
                outMessage.message = delete_message + " en la tabla DB_USERSPROFILES";
                outMessage.data = data_delete;
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('uStateUserProfiles', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSPROFILES" SET DELETESTATUS = $3 WHERE "USERID" = $1 AND PROFILEID = $2`;
            let responseUpdate = await db.run(queryUpdate, [param.USERID, param.PROFILEID, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_update_message,
                data: {}
            };
            if (responseUpdate === 1) {
                outMessage.code = 200;
                outMessage.message = update_message + " en la tabla DB_USERSPROFILES";
                outMessage.data = await getRegister("DB_USERSPROFILES", "USERID", param.USERID, "PROFILEID", param.PROFILEID);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('uStateUsersvendors', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSVENDORS" SET DELETESTATUS = $3 WHERE "USERID_USERID" = $1 AND VENDORID = $2`;
            let responseUpdate = await db.run(queryUpdate, [param.USERID, param.VENDORID, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_update_message,
                data: {}
            };
            if (responseUpdate === 1) {
                outMessage.code = 200;
                outMessage.message = update_message + " en la tabla DB_USERSVENDORS";
                outMessage.data = await getRegister("DB_USERSVENDORS", "USERID_USERID", param.USERID, "VENDORID", param.VENDORID);
            }
            return outMessage;

        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gProfilesUserLaunchpad', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            if (param.PROFILEID.length > 0) {
                let query = `SELECT`;
                query += ` U.USERID, UM.EMAIL, U.DELETESTATUS, UT.DESCRIPTION AS DESCRIPTION_USERSTYPE, US.DESCRIPTION AS DESCRIPTION_USERSSTATUS`;
                query += ` FROM "` + schemaName + `"."DB_USERSPROFILES" AS U`;
                query += ` INNER JOIN "` + schemaName + `"."DB_USERSMASTER" AS UM ON UM.USERID = U.USERID`;
                query += ` INNER JOIN "` + schemaName + `"."DB_USERSTYPE" AS UT ON UT.USERTYPEID = UM.USERTYPEID_USERTYPEID`;
                query += ` INNER JOIN "` + schemaName + `"."DB_USERSSTATUS" AS US ON US.USERSTATUSID = UM.USERSTATUSID_USERSTATUSID`;
                query += ` WHERE U.PROFILEID = '` + param.PROFILEID + `' ORDER BY U.USERID DESC;`;
                let response1 = await db.run(query);
                db.tx().commit();
                return response1;
            } else {
                res.status(400).json({
                    code: 302,
                    message: "Falta campo clave para completar la solicitud"
                });
            }
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gProfilesLaunchpad', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let query = `SELECT`;
            let userID = "";

            query += ` U.PROFILEID,U.APPID_APPID,U.ACCESSID_ACCESSID,U.DESCRIPTION AS PROFILES_DESCRIPTION,M.DESCRIPTION AS APPSMASTER_DESCRIPTION,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION,A.DESCRIPTION AS ACCESSTEXT_DESCRIPTION,M.URL`;
            query += ` FROM "` + schemaName + `"."DB_PROFILES" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_APPSMASTER" AS M ON U.APPID_APPID = M.APPID`;
            query += ` INNER JOIN "` + schemaName + `"."DB_ACCESSTEXT" AS A ON U.ACCESSID_ACCESSID = A.ACCESSID`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.PROFILEID DESC;`;
            let response1 = await db.run(query);
            let response2 = await db.run(query);
            let response3 = await db.run(query);
            db.tx().commit();
            let responseFinal = await eliminaDuplicado(response1, "PROFILEID");
            let functionRecorrer = async function (items, i) {
                if (items.length === i) {
                    return responseFinal;
                } else {
                    let item = items[i];
                    let array_apps = response2.filter(function (f1) {
                        return f1.PROFILEID === item.PROFILEID;
                    });
                    let apps = await eliminaDuplicado(array_apps, "APPID_APPID");
                    item.APLICACIONES = apps;
                    item.COUNT_APLICACIONES = apps.length;
                    item.DELETESTATUS_DESCRIPTION = "ACTIVO";
                    item.COUNT_USUARIOS = await getCountUserRol(item.PROFILEID);
                    delete item.ACCESSID_ACCESSID;
                    delete item.DELETESTATUS;
                    delete item.ACCESSTEXT_DESCRIPTION;
                    delete item.APPSMASTER_DESCRIPTION;
                    delete item.APPID_APPID;
                    delete item.URL;

                    let functionRecorrer2 = async function (items2, i2) {
                        if (items2.length === i2) {
                            i++;
                            await functionRecorrer(items, i);
                        } else {
                            let item2 = items2[i2];
                            let array_apps2 = response3.filter(function (f2) {
                                return f2.APPID_APPID === item2.APPID_APPID && f2.PROFILEID === item.PROFILEID;
                            });
                            let apps2 = await eliminaDuplicado(array_apps2, "ACCESSID_ACCESSID");
                            item2.ACCIONES = apps2;
                            item2.COUNT_ACCIONES = apps2.length;

                            delete item2.ACCESSID_ACCESSID;
                            delete item2.DELETESTATUS;
                            delete item2.DELETESTATUS_DESCRIPTION;
                            delete item2.ACCESSTEXT_DESCRIPTION;
                            delete item2.PROFILES_DESCRIPTION;
                            delete item2.PROFILEID;
                            i2++;
                            await functionRecorrer2(items2, i2);
                        }
                    }
                    await functionRecorrer2(apps, 0);
                }
            }
            await functionRecorrer(responseFinal, 0);
            return responseFinal;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gProfilesPortal', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let query = `SELECT`;
            let userID = "";
            if (param.userID !== undefined) {
                userID = param.userID.toString();
            }
            query += ` U.PROFILEID,U.APPID_APPID,U.ACCESSID_ACCESSID,U.DESCRIPTION,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_PROFILES" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_APPSMASTER" AS M ON U.APPID_APPID = M.APPID`;
            query += ` INNER JOIN "` + schemaName + `"."DB_ACCESSTEXT" AS A ON U.ACCESSID_ACCESSID = A.ACCESSID`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.PROFILEID DESC;`;
            let response1 = await db.run(query);
            db.tx().commit();

            if (userID.length > 0 && response1.length > 0) {
                let functionRecorrer = async function (items, i) {
                    if (items.length === i) {
                        return response1;
                    } else {
                        let item = items[i];
                        let query1 = `SELECT PROFILEID FROM "` + schemaName + `"."DB_USERSPROFILES" WHERE "PROFILEID" = '` + item.PROFILEID + `'`;
                        let response1 = await db.run(query1);
                        db.tx().commit();
                        item.ASSIGNED = false;
                        if (response1.length > 0) {
                            item.ASSIGNED = true;
                        }
                        i++;
                        await functionRecorrer(items, i);
                    }
                }
                if (userID.length > 0) {
                    await functionRecorrer(response1, 0);
                    let responseFinal = await eliminaDuplicado(response1, "PROFILEID");

                    return responseFinal;
                } else {
                    return response1;
                }
            } else {
                return response1;
            }
        } catch (e) {
            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gProfilesPortal", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gProfiles', async req => {
        //key profileID 10 key appID 10 key accessID 2 description 30 deleteStatus 1
        let { res } = req.http;
        try {
            let param = req.data.input;
            let query = `SELECT`;
            let userID = "";
            if (param.userID !== undefined) {
                userID = param.userID.toString();
            }
            query += ` U.PROFILEID,U.APPID_APPID,U.ACCESSID_ACCESSID,U.DESCRIPTION,U.DELETESTATUS,SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_PROFILES" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_APPSMASTER" AS M ON U.APPID_APPID = M.APPID`;
            query += ` INNER JOIN "` + schemaName + `"."DB_ACCESSTEXT" AS A ON U.ACCESSID_ACCESSID = A.ACCESSID`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.PROFILEID DESC;`;
            let response1 = await db.run(query);
            db.tx().commit();

            if (userID.length > 0 && response1.length > 0) {
                let userID = param.userID.toString();
                let functionRecorrer = async function (items, i) {
                    if (items.length === i) {
                        return response1;
                    } else {
                        let item = items[i];
                        let query1 = `SELECT PROFILEID FROM "` + schemaName + `"."DB_USERSPROFILES" WHERE "PROFILEID" = '` + item.PROFILEID + `' AND "USERID"=` + Number(userID);
                        let response1 = await db.run(query1);
                        db.tx().commit();
                        item.ASSIGNED = false;
                        if (response1.length > 0) {
                            item.ASSIGNED = true;
                        }
                        i++;
                        await functionRecorrer(items, i);
                    }
                }
                if (userID.length > 0) {
                    await functionRecorrer(response1, 0);
                    let responseFinal = await eliminaDuplicado(response1, "PROFILEID");

                    return responseFinal;
                } else {
                    return response1;
                }
            } else {
                return response1;
            }
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('cProfiles', async req => {
        //key profileID 10 key appID 10 key accessID 2 description 30 deleteStatus 1
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_PROFILES" (PROFILEID,APPID_APPID,ACCESSID_ACCESSID,DESCRIPTION,DELETESTATUS) VALUES ($1,$2,$3,$4,$5)`;
            let responseInsert = await db.run(queryInsert, [param.PROFILEID, param.APPID, param.ACCESSID, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();
            return responseInsert;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('uProfiles', async req => {
        //key profileID 10 key appID 10 key accessID 2 description 30 deleteStatus 1
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_PROFILES" SET PROFILEID = $1, APPID_APPID = $2, ACCESSID_ACCESSID = $3, DESCRIPTION = $4, DELETESTATUS = $5 WHERE "PROFILEID" = $1 AND APPID_APPID = $2 AND ACCESSID_ACCESSID = $3`;
            let responseUpdate = await db.run(queryUpdate, [param.PROFILEID, param.APPID, param.ACCESSID, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();
            return responseUpdate;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('dProfiles', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;

            const d1 = await getRegister("DB_PROFILES", "PROFILEID", param.PROFILEID);
            const d2 = await getRegister("DB_USERSPROFILES", "PROFILEID", param.PROFILEID);
            const data_delete = [...d1, ...d2];
            let queryDelete1 = `DELETE FROM "` + schemaName + `"."DB_PROFILES" WHERE PROFILEID = $1`;
            let responseDelete1 = await db.run(queryDelete1, [param.PROFILEID]);
            db.tx().commit();
            let queryDelete2 = `DELETE FROM "` + schemaName + `"."DB_USERSPROFILES" WHERE PROFILEID = $1`;
            let responseDelete2 = await db.run(queryDelete2, [param.PROFILEID]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_delete_message,
                data: {}
            };

            outMessage.code = 200;
            outMessage.message = delete_message + " en la tabla DB_PROFILES y DB_USERSPROFILES";
            outMessage.data = data_delete;

            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gITOS', async req => {
        let { res } = req.http;
        try {

            let param = req.data.input;
            let pge = param.PURCHASING_GROUP_ERP;

            let query1 = `SELECT`;
            query1 += ` U.USERID,U.EMAIL,U.USER_ERP,U.PURCHASING_GROUP_ERP,U.USERTYPEID_USERTYPEID,U.USERSTATUSID_USERSTATUSID,U.AUTH0ID`;
            query1 += ` FROM "` + schemaName + `"."DB_USERSMASTER" AS U`;
            query1 += ` INNER JOIN "` + schemaName + `"."DB_USERSTYPE" AS TY ON U.USERTYPEID_USERTYPEID = TY.USERTYPEID`;

            let queryFilter = ` WHERE `;
            queryFilter += `USERTYPEID_USERTYPEID = '04' AND PURCHASING_GROUP_ERP = '` + pge + `'`;
            queryFilter = queryFilter.length > 7 ? queryFilter + " AND " : queryFilter;
            queryFilter += ` (USERSTATUSID_USERSTATUSID = '01' OR USERSTATUSID_USERSTATUSID = '02' OR USERSTATUSID_USERSTATUSID = '10')`;
            queryFilter = queryFilter.length > 7 ? queryFilter : "";
            query1 += queryFilter;
            query1 += ` GROUP BY U.USERID,U.EMAIL,U.USER_ERP,U.PURCHASING_GROUP_ERP,U.USERTYPEID_USERTYPEID,U.USERSTATUSID_USERSTATUSID,U.AUTH0ID`;
            let response1 = await db.run(query1);
            db.tx().commit();
            let itos = [];

            if (response1.length > 0) {

                let responseAuth0 = await getAuth0();
                let tokenData = responseAuth0.data;
                let urlOnly = responseAuth0.urlOnly;
                let accessToken = tokenData.access_token;
                let allUserAuth0 = await getAllDataUserAuth0(accessToken, urlOnly);
                console.log(`allUserAuth0: ${JSON.stringify(allUserAuth0)}`);

                let functionRecorrer = async function (items, i) {
                    if (items.length === i) {
                        return response1;
                    } else {
                        let item = items[i];
                        let idUser = item.AUTH0ID;
                        let responseFinal = allUserAuth0.filter(function (ef) {
                            return ef.user_id === idUser;
                        });

                        item.DATA_AUTH0 = {
                            create: false
                        };

                        if (responseFinal.length > 0) {
                            item.DATA_AUTH0 = responseFinal[0];
                            item.DATA_AUTH0.create = true;
                        } else {
                            let du = await getDataUserAuth0(idUser, accessToken, urlOnly);

                            if (du.resolve === true) {
                                item.DATA_AUTH0 = du;
                                item.DATA_AUTH0.create = true;
                            }

                        }
                        itos.push({
                            USER_MAIL: item.EMAIL,
                            USER_NAME: item.DATA_AUTH0.create === true ? item.DATA_AUTH0.name : "",
                            USER_ERP: item.USER_ERP,
                            PURCHASING_GROUP_ERP: item.PURCHASING_GROUP_ERP
                        });
                        i++;
                        await functionRecorrer(items, i);
                    }
                };
                await functionRecorrer(response1, 0);
                return itos;
            } else {
                return itos;
            }
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gUsersMaster', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let userTypeId = param.USERTYPEID;
            let userStatusId = param.USERSTATUSID;
            let dataAuth0 = false;

            let query1 = `SELECT`;
            query1 += ` U.USERID,U.EMAIL,U.FIRSTCHANGEPASS,U.DATEFIRSTCHANGEPASS,U.USER_ERP,U.PURCHASING_GROUP_ERP,U.USERTYPEID_USERTYPEID,U.USERSTATUSID_USERSTATUSID,U.AUTH0ID`;
            query1 += `,TY.DESCRIPTION AS DESCRIPTION_USERTYPE,ST.DESCRIPTION AS DESCRIPTION_USERSTATUS`;
            query1 += `,COUNT(DISTINCT UV.VENDORID) AS COUNT_PROVEEDORES`;
            query1 += ` FROM "` + schemaName + `"."DB_USERSMASTER" AS U`;
            query1 += ` INNER JOIN "` + schemaName + `"."DB_USERSTYPE" AS TY ON U.USERTYPEID_USERTYPEID = TY.USERTYPEID`;
            query1 += ` INNER JOIN "` + schemaName + `"."DB_USERSSTATUS" AS ST ON U.USERSTATUSID_USERSTATUSID = ST.USERSTATUSID`;
            query1 += ` LEFT JOIN "` + schemaName + `"."DB_USERSVENDORS" AS UV ON U.USERID = UV.USERID_USERID AND UV.DELETESTATUS != '0'`;
            let queryFilter = ` WHERE `;
            if (userTypeId.length > 0) {
                queryFilter += `USERTYPEID_USERTYPEID = '` + userTypeId + `'`;
            }
            queryFilter = queryFilter.length > 7 ? queryFilter + " AND " : queryFilter;
            if (userStatusId.length > 0) {
                queryFilter += `USERSTATUSID_USERSTATUSID = '` + userStatusId + `'`;
            }
            queryFilter = queryFilter.length > 7 ? queryFilter : "";
            query1 += queryFilter;
            query1 += ` GROUP BY U.USERID,U.EMAIL,U.FIRSTCHANGEPASS,U.DATEFIRSTCHANGEPASS,U.USER_ERP,U.PURCHASING_GROUP_ERP,U.USERTYPEID_USERTYPEID,U.USERSTATUSID_USERSTATUSID,U.AUTH0ID,TY.DESCRIPTION,ST.DESCRIPTION`;
            let response1 = await db.run(query1);
            db.tx().commit();

            if (param.paramAuth0 !== undefined && response1.length > 0) {
                dataAuth0 = true;
                let paramAuth0 = param.paramAuth0;
                let accessToken = paramAuth0.AccessToken;
                let urlOnly = paramAuth0.Url;
                let allUserAuth0 = await getAllDataUserAuth0(accessToken, urlOnly);
                console.log(`allUserAuth0: ${JSON.stringify(allUserAuth0)}`);

                let functionRecorrer = async function (items, i) {
                    if (items.length === i) {
                        return response1;
                    } else {
                        let item = items[i];
                        let idUser = item.AUTH0ID;
                        let responseFinal = allUserAuth0.filter(function (ef) {
                            return ef.user_id === idUser;
                        });

                        item.DATA_AUTH0 = {
                            create: false
                        };

                        if (responseFinal.length > 0) {
                            item.DATA_AUTH0 = responseFinal[0];
                            item.DATA_AUTH0.create = true;
                        } else {
                            let du = await getDataUserAuth0(idUser, accessToken, urlOnly);

                            if (du.resolve === true) {
                                item.DATA_AUTH0 = du;
                                item.DATA_AUTH0.create = true;
                            }

                        }
                        i++;
                        await functionRecorrer(items, i);
                    }
                };
                await functionRecorrer(response1, 0);
                return response1;
            } else {
                return response1;
            }
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('cUsersMaster', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryDuplicate = `SELECT U.EMAIL FROM "` + schemaName + `"."DB_USERSMASTER" AS U WHERE "EMAIL"='` + param.EMAIL + `'`;
            let responseDuplicate = await db.run(queryDuplicate);

            if (responseDuplicate.length === 0) {
                let queryId = `SELECT U.USERID FROM "` + schemaName + `"."DB_USERSMASTER" AS U ORDER BY U.USERID DESC`;
                let responseId = await db.run(queryId);
                let userId = 1;

                if (responseId.length > 0) {
                    userId = (responseId[0].USERID + 1);
                }

                if (param.paramAuth0 !== undefined) {

                    let paramAuth0 = param.paramAuth0;
                    let accessToken = paramAuth0.AccessToken;
                    let urlOnly = paramAuth0.Url;

                    let is1 = userId.toString().length;
                    let cs1 = param.EMAIL.split("@")[0];
                    let user_name = cs1 + userId;

                    if (user_name.length > 20) {
                        user_name = cs1.slice(0, (cs1.length - is1)) + userId;
                    }

                    let addUserAuth0 = await addAuth0(urlOnly, accessToken, param, user_name);
                    if (addUserAuth0.status === 200 || addUserAuth0.status === 201) {
                        param.AUTH0ID = addUserAuth0.data.user_id;
                        let queryInsert = `INSERT INTO "` + schemaName + `"."DB_USERSMASTER" (USERID,EMAIL,FIRSTCHANGEPASS,DATEFIRSTCHANGEPASS,USER_ERP,PURCHASING_GROUP_ERP,USERTYPEID_USERTYPEID,USERSTATUSID_USERSTATUSID,AUTH0ID,SECRET) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;
                        let responseInsert = await db.run(queryInsert, [userId, param.EMAIL, param.FIRSTCHANGEPASS, param.DATEFIRSTCHANGEPASS, param.USER_ERP, param.PURCHASING_GROUP_ERP, param.USERTYPEID_USERTYPEID, param.USERSTATUSID_USERSTATUSID, param.AUTH0ID, null]);
                        db.tx().commit();

                        if (responseInsert === 1 && param.USERTYPEID_USERTYPEID !== "01") {

                            let profile = 'PROFILE_REPRE';
                            let queryInsert1 = `INSERT INTO "` + schemaName + `"."DB_USERSPROFILES" (USERID,PROFILEID,DELETESTATUS) VALUES ($1,$2,$3)`;
                            let response1 = await db.run(queryInsert1, [userId, profile, '1']);

                            if (param.VENDORS.length > 0) {
                                let functionRecorrerSupplier = async function (itemsS, iS) {
                                    if (itemsS.length === iS) {
                                        return;
                                    } else {
                                        let vend = itemsS[iS].code;
                                        let queryInsertVendor = `INSERT INTO "` + schemaName + `"."DB_USERSVENDORS" (USERID_USERID,VENDORID,FIRSTACCESS,DATEFIRSTACCESS,DELETESTATUS) VALUES ($1,$2,$3,$4,$5)`;
                                        let responseVendor = await db.run(queryInsertVendor, [userId, vend, 0, null, '1']);
                                        db.tx().commit();
                                        iS++;
                                        await functionRecorrerSupplier(itemsS, iS);
                                    }
                                };
                                await functionRecorrerSupplier(param.VENDORS, 0);

                                let outMessage = {
                                    code: 400,
                                    message: not_add_message,
                                    data: {}
                                };

                                outMessage.code = 200;
                                outMessage.message = add_message + " en la tabla DB_USERSMASTER";
                                outMessage.data = await getRegister("DB_USERSMASTER", "USERID", userId);

                                return outMessage;
                            } else {

                                let outMessage = {
                                    code: 400,
                                    message: not_add_message,
                                    data: {}
                                };

                                outMessage.code = 200;
                                outMessage.message = add_message + " en la tabla DB_USERSMASTER";
                                outMessage.data = await getRegister("DB_USERSMASTER", "USERID", userId);

                                return outMessage;
                            }
                        } else if (responseInsert === 1 && param.USERTYPEID_USERTYPEID !== "04") {

                            let profile = 'PROFILE_ITO';
                            let queryInsert1 = `INSERT INTO "` + schemaName + `"."DB_USERSPROFILES" (USERID,PROFILEID,DELETESTATUS) VALUES ($1,$2,$3)`;
                            let response3 = await db.run(queryInsert1, [userId, profile, '1']); db.tx().commit();

                            let outMessage = {
                                code: 400,
                                message: not_add_message,
                                data: {}
                            };

                            outMessage.code = 200;
                            outMessage.message = add_message + " en la tabla DB_USERSMASTER";
                            outMessage.data = await getRegister("DB_USERSMASTER", "USERID", userId);

                            return outMessage;
                        } else {
                            let profile = 'PROFILE_ADMIN';
                            let queryInsert2 = `INSERT INTO "` + schemaName + `"."DB_USERSPROFILES" (USERID,PROFILEID,DELETESTATUS) VALUES ($1,$2,$3)`;
                            let response2 = await db.run(queryInsert2, [userId, profile, '1']);
                            db.tx().commit();

                            let outMessage = {
                                code: 400,
                                message: not_add_message,
                                data: {}
                            };

                            outMessage.code = 200;
                            outMessage.message = add_message + " en la tabla DB_USERSMASTER";
                            outMessage.data = await getRegister("DB_USERSMASTER", "USERID", userId);

                            return outMessage;
                        }
                    } else {
                        res.status(addUserAuth0.status).json(addUserAuth0);
                    }
                } else {
                    res.status(500).json({ message: "No fue posible crear el usuario." });
                }
            } else {
                res.status(409).json({ message: "El correo ingresado ya existe en el portal.", status: 409 });
            }
        } catch (e) {
            throw new Error(e);
        }
    });
    this.on('uUsersMaster', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;

            if (param.paramAuth0 !== undefined) {

                let paramAuth0 = param.paramAuth0;
                let accessToken = paramAuth0.AccessToken;
                let urlOnly = paramAuth0.Url;

                if (param.CHANGE_EMAIL !== "") {
                    let queryDuplicate = `SELECT U.EMAIL FROM "` + schemaName + `"."DB_USERSMASTER" AS U WHERE "EMAIL"='` + param.CHANGE_EMAIL + `'`;
                    let responseDuplicate = await db.run(queryDuplicate);

                    if (responseDuplicate.length !== 0) {
                        res.status(409).json({ message: "El correo ingresado para modificar ya existe en el portal.", status: 409 });
                    }
                    param.EMAIL = param.CHANGE_EMAIL;
                }

                let addUserAuth0 = await editAuth0(urlOnly, accessToken, param);

                if (addUserAuth0.status === 200 || addUserAuth0.status === 201) {

                    let queryDelete1 = `DELETE FROM "` + schemaName + `"."DB_USERSPROFILES" WHERE USERID = ` + param.USERID + ` AND (PROFILEID = 'PROFILE_ADMIN' OR PROFILEID = 'PROFILE_REPRE')`;
                    let response2 = await db.run(queryDelete1);
                    db.tx().commit();

                    let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSMASTER" SET USERTYPEID_USERTYPEID = $2, USERSTATUSID_USERSTATUSID = $3, EMAIL = $4, USER_ERP = $5, PURCHASING_GROUP_ERP = $6 WHERE "USERID" = $1`;
                    let responseUpdate = await db.run(queryUpdate, [param.USERID, param.USERTYPEID_USERTYPEID, param.USERSTATUSID_USERSTATUSID, param.EMAIL, param.USER_ERP, param.PURCHASING_GROUP_ERP]);
                    db.tx().commit();

                    if (param.USERSTATUSID_USERSTATUSID === "10") {
                        let queryUpdate = `UPDATE "` + schemaName + `"."DB_USERSMASTER" SET FIRSTCHANGEPASS = $2, DATEFIRSTCHANGEPASS = $3 WHERE "USERID" = $1`;
                        let responseUpdate = await db.run(queryUpdate, [param.USERID, 0, null]);
                        db.tx().commit();

                        let quertDelete = `DELETE FROM "` + schemaName + `"."DB_TERMSANDCONDITIONSLOG" WHERE "USERID_USERID" = $1`;
                        let responseDelete = await db.run(quertDelete, [param.USERID]);
                        db.tx().commit();
                    }

                    let profile3 = '';
                    if (param.USERTYPEID_USERTYPEID === "01") {
                        profile3 = 'PROFILE_ADMIN';
                        let queryDelete2 = `DELETE FROM "` + schemaName + `"."DB_USERSPROFILES" WHERE USERID = ` + param.USERID;
                        let response3 = await db.run(queryDelete2);
                        db.tx().commit();
                    } else if (param.USERTYPEID_USERTYPEID === "02") {
                        profile3 = 'PROFILE_REPRE';
                    } else if (param.USERTYPEID_USERTYPEID === "04") {
                        profile3 = 'PROFILE_ITO';
                        let queryDelete2 = `DELETE FROM "` + schemaName + `"."DB_USERSPROFILES" WHERE USERID = ` + param.USERID;
                        let response3 = await db.run(queryDelete2);
                    }

                    if (profile3.length > 0) {
                        let queryInsert3 = `INSERT INTO "` + schemaName + `"."DB_USERSPROFILES" (USERID,PROFILEID,DELETESTATUS) VALUES ($1,$2,$3)`;
                        let response3 = await db.run(queryInsert3, [param.USERID, profile3, '1']);
                        db.tx().commit();
                    }

                    let outMessage = {
                        code: 400,
                        message: not_update_message,
                        data: {}
                    };

                    outMessage.code = 200;
                    outMessage.message = update_message + " en la tabla DB_USERSMASTER";
                    outMessage.data = await getRegister("DB_USERSMASTER", "USERID", param.USERID);

                    return outMessage;

                } else {
                    res.status(addUserAuth0.status).json(addUserAuth0);
                }
            } else {
                res.status(500).json({ message: "No fue posible editar el usuario." });
            }

        } catch (e) {
            throw new Error(e);
        }
    });

    this.on('gValidatePassUsers', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado",
                    validate: validate
                });
            }
            if (validate === "OK") {
                param.Mail = await getMailForSecret(param);

                if (param.Password !== undefined) {

                    let outMessage = {
                        validate_pass: null
                    };

                    try {
                        let addUserAuth0 = await editPassAuth0(param);
                        outMessage.validate_pass = addUserAuth0
                    } catch (e) {
                        outMessage.validate_pass = false;
                    }

                    return outMessage;

                } else {
                    res.status(500).json({ message: "No fue posible validar la contraseña del usuario." });
                }

            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados",
                    validate: validate
                });
            }

        } catch (e) {
            throw new Error(e);
        }
    });

    this.on('gMaterialDocumentsSet', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let filter = param.Filters;
            let supplier = filter.SUPPLIER;
            let declarationDate_I = filter.DECLARATIONDATE_I;
            let declarationDate_F = filter.DECLARATIONDATE_F;

            let queryDynamic2 = "";

            if (supplier.length > 0) {
                queryDynamic2 = `Supplier='` + supplier + `'`;
            }

            if (declarationDate_I.length > 0 && declarationDate_F.length > 0) {
                queryDynamic2 += ` and (Postingdate>='` + declarationDate_I + `' and Postingdate<='` + declarationDate_F + `')`;
                if (supplier.length === 0) {
                    queryDynamic2 = `Postingdate>='` + declarationDate_I + `' and Postingdate<='` + declarationDate_F + `'`;
                }
            }

            let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
            let { materialDocumentsSet } = PORTAL_PROVEEDORES.entities;
            let arrayResult = await PORTAL_PROVEEDORES.run(SELECT.from(materialDocumentsSet).where(queryDynamic2));
            return arrayResult;
        } catch (e) {
            throw new Error(nn);
        }
    });

    this.on('gMaterialDocumentsItemsSet', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let filter = param.Filters;
            let purchaseorder = filter.PURCHASEORDER;
            let materialDocument = filter.MATERIALDOCUMENT;

            let queryDynamic2 = "";

            if (purchaseorder.length > 0) {
                queryDynamic2 = `Purchaseorder='` + purchaseorder + `'`;
            }

            if (materialDocument.length > 0) {
                queryDynamic2 += ` and Materialdocument='` + materialDocument + `'`;
            }

            let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
            let { materialDocumentsItemsSet } = PORTAL_PROVEEDORES.entities;
            let arrayResult = await PORTAL_PROVEEDORES.run(SELECT.from(materialDocumentsItemsSet).where(queryDynamic2));
            return arrayResult;
        } catch (e) {
            throw new Error(nn);
        }
    });

    this.on('gDeclareDelivery', async req => {

        let { res } = req.http;
        let cookieBase = await setCookieBase(req);

        try {

            let resultService = {
                WidgetCountApproved_Ser: 0,
                WidgetCountRejected_Ser: 0,
                WidgetCountPendding_Ser: 0,
                WidgetCount_Mat: 0,
                Data_Mat: [],
                Data_Ser: [],
                queryDynamic: "",
                data_hana: []
            };

            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;

            let validate = await validateSession(param, req);

            if (validate === "DURATION") {
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
                return;
            }

            param.Supplier = await getSupplierForSecret(param);

            if (validate === "OK") {

                let supplier = param.Supplier;
                let filter = param.Filters;

                let category = filter.PURCHASEORDERITEMCATEGORY;
                let purchaseOrder = filter.PURCHASEORDER;
                let companyCode = filter.COMPANYCODE;
                let declarationStatus = filter.DECLARATIONSTATUS;
                let declarationDate_I = filter.DECLARATIONDATE_I;
                let declarationDate_F = filter.DECLARATIONDATE_F;
                let sheetNumber = filter.SHEETNUMBER;
                let declarationidentifier = filter.DECLARATIONIDENTIFIER;
                let whereDeclareDelivery = [];

                if (declarationidentifier.length > 0) {
                    whereDeclareDelivery.push(
                        { ref: ["DECLARATIONIDENTIFIER"] },
                        "=",
                        { val: declarationidentifier }
                    );
                }

                if (supplier.length > 0) {
                    let su = Number(supplier);

                    if (whereDeclareDelivery.length > 0) {
                        whereDeclareDelivery.push("and");
                    }

                    whereDeclareDelivery.push(
                        { ref: ["SUPPLIER"] },
                        "=",
                        { val: su.toString() }
                    );
                }

                if (declarationDate_I.length > 0 && declarationDate_F.length > 0) {

                    if (whereDeclareDelivery.length > 0) {
                        whereDeclareDelivery.push("and");
                    }

                    whereDeclareDelivery.push(
                        { ref: ["DECLARATIONDATE"] },
                        ">=",
                        { val: declarationDate_I },
                        "and",
                        { ref: ["DECLARATIONDATE"] },
                        "<=",
                        { val: declarationDate_F }
                    );
                }

                if (category.length > 0) {

                    if (whereDeclareDelivery.length > 0) {
                        whereDeclareDelivery.push("and");
                    }

                    whereDeclareDelivery.push(
                        { ref: ["PURCHASEORDERITEMCATEGORY"] },
                        "=",
                        { val: category }
                    );

                } else {

                    if (whereDeclareDelivery.length > 0) {
                        whereDeclareDelivery.push("and");
                    }

                    whereDeclareDelivery.push(
                        { ref: ["PURCHASEORDERITEMCATEGORY"] },
                        "=",
                        { val: "" }
                    );
                }

                if (purchaseOrder.length > 0) {

                    if (whereDeclareDelivery.length > 0) {
                        whereDeclareDelivery.push("and");
                    }

                    whereDeclareDelivery.push(
                        { ref: ["PURCHASEORDER"] },
                        "=",
                        { val: purchaseOrder }
                    );
                }

                if (companyCode.length > 0) {

                    if (whereDeclareDelivery.length > 0) {
                        whereDeclareDelivery.push("and");
                    }

                    whereDeclareDelivery.push(
                        { ref: ["COMPANYCODE"] },
                        "=",
                        { val: companyCode }
                    );
                }

                if (sheetNumber.length > 0) {

                    if (whereDeclareDelivery.length > 0) {
                        whereDeclareDelivery.push("and");
                    }

                    whereDeclareDelivery.push(
                        { ref: ["SHEETNUMBER"] },
                        "=",
                        { val: sheetNumber }
                    );
                }

                let response1 = await db.run(
                    SELECT.from("DB_DECLAREDELIVERY")
                        .where(whereDeclareDelivery)
                );

                db.tx().commit();

                let PORTAL_PROVEEDORES;

                if (category === "9") {

                    PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');

                    try {

                        const { ServiceEntrySheetSet } = PORTAL_PROVEEDORES.entities;

                        let whereServiceEntrySheet = [];

                        if (supplier.length > 0) {

                            whereServiceEntrySheet.push(
                                { ref: ["Supplier"] },
                                "=",
                                { val: supplier }
                            );
                        }

                        if (declarationDate_I.length > 0 && declarationDate_F.length > 0) {

                            if (whereServiceEntrySheet.length > 0) {
                                whereServiceEntrySheet.push("and");
                            }

                            whereServiceEntrySheet.push(
                                { ref: ["Postingdate"] },
                                ">=",
                                { val: declarationDate_I },
                                "and",
                                { ref: ["Postingdate"] },
                                "<=",
                                { val: declarationDate_F }
                            );
                        }

                        if (purchaseOrder.length > 0) {

                            if (whereServiceEntrySheet.length > 0) {
                                whereServiceEntrySheet.push("and");
                            }

                            whereServiceEntrySheet.push(
                                { ref: ["Purchaseorder"] },
                                "=",
                                { val: purchaseOrder }
                            );
                        }

                        if (companyCode.length > 0) {

                            if (whereServiceEntrySheet.length > 0) {
                                whereServiceEntrySheet.push("and");
                            }

                            whereServiceEntrySheet.push(
                                { ref: ["Companycode"] },
                                "=",
                                { val: companyCode }
                            );
                        }

                        if (declarationStatus.length > 0) {

                            if (declarationStatus === "V") {

                                if (whereServiceEntrySheet.length > 0) {
                                    whereServiceEntrySheet.push("and");
                                }

                                whereServiceEntrySheet.push(
                                    { ref: ["Approvalstatus"] },
                                    "=",
                                    { val: "" }
                                );

                            } else if (declarationStatus === "R") {

                                if (whereServiceEntrySheet.length > 0) {
                                    whereServiceEntrySheet.push("and");
                                }

                                whereServiceEntrySheet.push(
                                    { ref: ["Deletestatus"] },
                                    "=",
                                    { val: true }
                                );

                            } else {

                                if (whereServiceEntrySheet.length > 0) {
                                    whereServiceEntrySheet.push("and");
                                }

                                whereServiceEntrySheet.push(
                                    { ref: ["Approvalstatus"] },
                                    "=",
                                    { val: declarationStatus }
                                );
                            }
                        }

                        if (sheetNumber.length > 0) {

                            if (whereServiceEntrySheet.length > 0) {
                                whereServiceEntrySheet.push("and");
                            }

                            whereServiceEntrySheet.push(
                                { ref: ["Serviceentrysheet"] },
                                "=",
                                { val: sheetNumber }
                            );
                        }

                        let resultHes = await PORTAL_PROVEEDORES.run(
                            SELECT.from(ServiceEntrySheetSet, a => {
                                a(),
                                    a.navHesToHesItems(),
                                    a.navHesToHesItems2()
                            }).where(whereServiceEntrySheet)
                        );

                        resultService.resultHes = resultHes;

                        let countApproved = 0;
                        let countPendding = 0;
                        let countRejected = 0;

                        let functionRecorrer = async function (items, i) {

                            if (items.length === i) {

                                resultService.WidgetCountApproved_Ser = countApproved;
                                resultService.WidgetCountPendding_Ser = countPendding;
                                resultService.WidgetCountRejected_Ser = countRejected;

                                let resultFinal = resultHes;

                                if (declarationidentifier.length > 0) {
                                    resultFinal = resultHes.filter(function (fg) {
                                        return fg.ExtNumber === declarationidentifier;
                                    });
                                }

                                resultService.Data_Ser = resultFinal;

                                return resultService;

                            } else {

                                let item = items[i];

                                item.navHesToHesItems = item.navHesToHesItems2;
                                item.MotivoRechazo = "";
                                item.FechaRechazo = "-";
                                item.DescripcionDeclaracion = "";

                                if (item.Isdeleted) {

                                    if (item.Message.includes("-MOTIVO RECHAZO:")) {

                                        let comentario = item.Message.split("-MOTIVO RECHAZO:")[0];
                                        let motivoRechazo = item.Message.split("-MOTIVO RECHAZO:")[1];

                                        item.MotivoRechazo = motivoRechazo;
                                        item.DescripcionDeclaracion = comentario;

                                        if (motivoRechazo.includes("-FECHA:")) {

                                            let fechaRechazo =
                                                motivoRechazo.split("-FECHA:")[1].length === 0
                                                    ? "-"
                                                    : motivoRechazo.split("-FECHA:")[1];

                                            item.FechaRechazo = fechaRechazo;
                                            item.MotivoRechazo = motivoRechazo.split("-FECHA:")[0];
                                        }
                                    }

                                    countRejected++;

                                } else {

                                    item.DescripcionDeclaracion = item.Message;

                                    if (item.Approvalstatus === "X") {
                                        countApproved++;
                                    }

                                    if (item.Approvalstatus === "") {
                                        countPendding++;
                                    }
                                }

                                item.ATTACHMENTS_DECLARATION = [];
                                item.ITEMSDELIVERYDECLARATION = [];

                                item.DATA_HANA = {
                                    DECLARATIONIDENTIFIER: null
                                };

                                if (item.Serviceentrysheet.length > 0) {

                                    let responseSelect2 = await db.run(
                                        SELECT.from("DB_DECLAREDELIVERY")
                                            .where({
                                                SHEETNUMBER: item.Serviceentrysheet
                                            })
                                    );

                                    db.tx().commit();

                                    if (responseSelect2.length > 0) {

                                        let item2 = responseSelect2[0];

                                        item.DECLARATIONIDENTIFIER =
                                            item2.DECLARATIONIDENTIFIER;

                                        let responseSelect1 = await db.run(
                                            SELECT.from("DB_DOCUMENTSDELIVERYDECLARATION")
                                                .where({
                                                    DECLARATIONIDENTIFIER:
                                                        item2.DECLARATIONIDENTIFIER
                                                })
                                        );

                                        db.tx().commit();

                                        item.ATTACHMENTS_DECLARATION = responseSelect1;

                                        let responseSelect3 = await db.run(
                                            SELECT.from("DB_ITEMSDELIVERYDECLARATION")
                                                .where({
                                                    DECLARATIONIDENTIFIER:
                                                        item2.DECLARATIONIDENTIFIER
                                                })
                                        );

                                        db.tx().commit();

                                        item.ITEMSDELIVERYDECLARATION = responseSelect3;

                                        if (responseSelect3.length > 0) {
                                        }

                                        if (item.Approvalstatus === "") {
                                            item.Serviceentrysheet = "";
                                            item2.SHEETNUMBER = "";
                                            item2.MESSAGESERVICE = "";
                                        }

                                        item.DATA_HANA = item2;

                                        i++;
                                        await functionRecorrer(items, i);

                                    } else {

                                        if (item.Approvalstatus === "") {
                                            item.Serviceentrysheet = "";
                                        }

                                        i++;
                                        await functionRecorrer(items, i);
                                    }

                                } else {

                                    if (item.Approvalstatus === "") {
                                        item.Serviceentrysheet = "";
                                    }

                                    i++;
                                    await functionRecorrer(items, i);
                                }
                            }
                        };

                        if (resultHes.length > 0) {
                            await functionRecorrer(resultHes, 0);
                            return resultService;
                        } else {
                            return resultService;
                        }

                    } catch (eCC) {

                        return resultService;
                    }

                } else {

                    resultService.WidgetCount_Mat = response1.length;

                    try {

                        PORTAL_PROVEEDORES =
                            await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');

                        const { materialDocumentsSet } =
                            PORTAL_PROVEEDORES.entities;

                        let whereMaterialDocuments = [];

                        if (supplier.length > 0) {

                            whereMaterialDocuments.push(
                                { ref: ["Supplier"] },
                                "=",
                                { val: supplier }
                            );
                        }

                        if (declarationDate_I.length > 0 && declarationDate_F.length > 0) {

                            if (whereMaterialDocuments.length > 0) {
                                whereMaterialDocuments.push("and");
                            }

                            whereMaterialDocuments.push(
                                "(",
                                { ref: ["Postingdate"] },
                                ">=",
                                { val: declarationDate_I },
                                "and",
                                { ref: ["Postingdate"] },
                                "<=",
                                { val: declarationDate_F },
                                ")"
                            );
                        }

                        if (supplier.length > 0) {

                            if (whereMaterialDocuments.length > 0) {
                                whereMaterialDocuments.push("and");
                            }

                            whereMaterialDocuments.push(
                                { ref: ["Purchaseorder"] },
                                "=",
                                { val: purchaseOrder }
                            );
                        }

                        let resultMIGO = await PORTAL_PROVEEDORES.run(
                            SELECT.from(materialDocumentsSet)
                                .where(whereMaterialDocuments)
                        );

                        let functionRecorrerMigo = async function (items4, i4) {

                            if (items4.length === i4) {
                                return resultService;

                            } else {

                                let item4 = items4[i4];

                                let json4 = {};

                                json4.ATTACHMENTS_DECLARATION = [];
                                json4.ITEMSDELIVERYDECLARATION = [];
                                json4.DECLARATIONIDENTIFIER = "Generada por Abastible";
                                json4.PURCHASEORDER = item4.Purchaseorder;
                                json4.COMPANYCODEDESCRIPTION = "Abastible S.A.";
                                json4.DESCRIPTIONDECLARATION = "—";
                                json4.DECLAREDAMOUNT = item4.AmountText;
                                json4.CURRENCY = item4.Currency;
                                json4.DECLAREDQUANTITY = "—";
                                json4.DECLARATIONDATE = item4.PostingdateText;
                                json4.SUPPLIER = item4.Supplier;
                                json4.SUPPLIERNAME = "";
                                json4.MATERIALDOCUMENT = item4.Materialdocument;
                                json4.MATERIALDOCUMENTDATE = item4.PostingdateText;
                                json4.REFERENCE = item4.Reference;

                                try {

                                    const { materialDocumentsItemsSet } =
                                        PORTAL_PROVEEDORES.entities;

                                    let whereMaterialDocumentsItems = [
                                        { ref: ["Purchaseorder"] },
                                        "=",
                                        { val: item4.Purchaseorder },
                                        "and",
                                        { ref: ["Materialdocument"] },
                                        "=",
                                        { val: item4.Materialdocument }
                                    ];

                                    let resultItemsMIGO =
                                        await PORTAL_PROVEEDORES.run(
                                            SELECT.from(materialDocumentsItemsSet)
                                                .where(whereMaterialDocumentsItems)
                                        );

                                    if (resultItemsMIGO.length > 0) {

                                        resultItemsMIGO.forEach(function (element4) {

                                            json4.ITEMSDELIVERYDECLARATION.push({

                                                PURCHASEORDERITEM:
                                                    element4.Materialdocumentitem,

                                                MATERIAL:
                                                    element4.Material,

                                                PURCHASEORDERITEMTEXT:
                                                    element4.Itemdescription,

                                                PURCHASEORDERQUANTITYUNIT:
                                                    element4.Unit,

                                                ORDERQUANTITYTEXT:
                                                    element4.Quantitytext,

                                                DOCUMENTCURRENCY:
                                                    element4.Currency,

                                                INVOICEDECLAREQUANTITY:
                                                    element4.DeclaredQuantityText,

                                                INVOICEQUANTITY:
                                                    element4.InvoicedQuantityText,

                                                NETPRICEAMOUNT:
                                                    element4.Amounttext,

                                                TOTPRICEDECLARE:
                                                    element4.TotalPriceText,

                                                PERCENTAGEDECLARE:
                                                    element4.PercentageDeclaredText
                                            });
                                        });
                                    }

                                } catch (e4) {
                                }

                                resultService.Data_Mat.push(json4);

                                i4++;
                                await functionRecorrerMigo(items4, i4);
                            }
                        };

                        let functionRecorrer2 = async function (items2, i2) {

                            if (items2.length === i2) {

                                return resultService;

                            } else {

                                let item2 = items2[i2];

                                item2.DECLAREDAMOUNT = Number(item2.DECLAREDAMOUNT);
                                item2.MATERIALDOCUMENT = "";
                                item2.REFERENCE = "";
                                item2.ATTACHMENTS_DECLARATION = [];
                                item2.ITEMSDELIVERYDECLARATION = [];

                                let responseSelect2 = await db.run(
                                    SELECT.from(
                                        "DB_DOCUMENTSDELIVERYDECLARATION"
                                    ).where({
                                        DECLARATIONIDENTIFIER:
                                            item2.DECLARATIONIDENTIFIER
                                    })
                                );

                                db.tx().commit();

                                item2.ATTACHMENTS_DECLARATION = responseSelect2;

                                let responseSelect4 = await db.run(
                                    SELECT.from(
                                        "DB_ITEMSDELIVERYDECLARATION"
                                    ).where({
                                        DECLARATIONIDENTIFIER:
                                            item2.DECLARATIONIDENTIFIER
                                    })
                                );

                                db.tx().commit();

                                responseSelect4.forEach(elementF => {

                                    elementF.INVOICEDECLAREQUANTITY =
                                        Number(elementF.INVOICEDECLAREQUANTITY);

                                    elementF.INVOICEQUANTITY =
                                        Number(elementF.INVOICEQUANTITY);

                                    elementF.NETPRICEAMOUNT =
                                        Number(elementF.NETPRICEAMOUNT);

                                    elementF.TOTPRICEDECLARE =
                                        Number(elementF.TOTPRICEDECLARE);

                                    elementF.INVOICEAVAILABLEQUANTITY =
                                        Number(elementF.INVOICEAVAILABLEQUANTITY);
                                });

                                item2.ITEMSDELIVERYDECLARATION =
                                    responseSelect4;

                                resultService.Data_Mat.push(item2);

                                i2++;

                                await functionRecorrer2(items2, i2);
                            }
                        };

                        if (response1.length > 0) {

                            await functionRecorrer2(response1, 0);

                            if (resultMIGO.length > 0) {
                                await functionRecorrerMigo(resultMIGO, 0);
                            }

                            return resultService;

                        } else {

                            if (resultMIGO.length > 0) {
                                await functionRecorrerMigo(resultMIGO, 0);
                            }

                            return resultService;
                        }

                    } catch (e) {

                        return res.status(500).json({
                            code: 500,
                            message: "Ocurrió un error al consultar la información"
                        });
                    }
                }

            } else {

                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }

        } catch (e) {

            return res.status(500).json({
                code: 500,
                message: "Ocurrió un error al consultar la información"
            });
        }
    });

    // this.on('gDeclareDelivery', async req => {
    //     let { res } = req.http;
    //     let cookieBase = await setCookieBase(req);
    //     try {
    //         let resultService = {
    //             WidgetCountApproved_Ser: 0,
    //             WidgetCountRejected_Ser: 0,
    //             WidgetCountPendding_Ser: 0,
    //             WidgetCount_Mat: 0,
    //             Data_Mat: [],
    //             Data_Ser: [],
    //             queryDynamic: "",
    //             data_hana: []
    //         };
    //         let param = req.data.input;
    //         let tokenSession = await getTokenSessionForCookies(req);
    //         param.TokenSession = tokenSession;

    //         let validate = await validateSession(param, req);
    //         if (validate === "DURATION") {
    //             //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gDeclareDelivery, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
    //             res.status(400).json({
    //                 code: 305,
    //                 message: "El tiempo de la sesion ha expirado"
    //             });
    //         }
    //         param.Supplier = await getSupplierForSecret(param);
    //         if (validate === "OK") {
    //             let supplier = param.Supplier;
    //             let filter = param.Filters;
    //             let category = filter.PURCHASEORDERITEMCATEGORY;
    //             let purchaseOrder = filter.PURCHASEORDER;
    //             let companyCode = filter.COMPANYCODE;
    //             let declarationStatus = filter.DECLARATIONSTATUS;
    //             let declarationDate_I = filter.DECLARATIONDATE_I;
    //             let declarationDate_F = filter.DECLARATIONDATE_F;
    //             let sheetNumber = filter.SHEETNUMBER;
    //             let declarationidentifier = filter.DECLARATIONIDENTIFIER;

    //             let query1 = `SELECT`;
    //             query1 += ` DD.DECLARATIONIDENTIFIER,DD.PURCHASEORDER,DD.PURCHASEORDERITEM,DD.PURCHASEORDERITEMCATEGORY,DD.PURCHASEORDERITEMCATEGORYTEXT,DD.SERVICEPACKAGE,DD.DATESERVICEPACKAGE,DD.DELIVERYADDRESS,DD.COMPANYCODE,DD.COMPANYCODEDESCRIPTION,DD.DECLAREDAMOUNT,DD.DECLARATIONDATE,DD.DESCRIPTIONDECLARATION,DD.SUPPLIERNAME,DD.SUPPLIER,DD.PLANNEDDATE,DD.CREATEDBYUSER,DD.CREATEDDATE,DD.DECLARATIONSTATUS,DD.SHEETNUMBER,DD.MESSAGESERVICE,DD.REALQUANTITY,DD.PURCHASEORDERITEMTEXT,DD.ITO_USER_ERP`;
    //             query1 += ` FROM ` + schemaName + `.DB_DECLAREDELIVERY AS DD`;
    //             let queryFilter = ` WHERE`;
    //             let queryDynamic = ``;

    //             if (declarationidentifier.length > 0) {
    //                 queryFilter += ` DD.DECLARATIONIDENTIFIER=` + declarationidentifier;
    //             }

    //             if (supplier.length > 0) {
    //                 let su = Number(supplier);
    //                 queryFilter = queryFilter.length > 7 ? queryFilter + " AND " : queryFilter;
    //                 queryFilter += ` DD.SUPPLIER = '` + su + `'`;
    //                 queryDynamic += `Supplier='` + supplier + `'`;
    //             }

    //             if (declarationDate_I.length > 0 && declarationDate_F.length > 0) {
    //                 queryFilter = queryFilter.length > 7 ? queryFilter + " AND " : queryFilter;
    //                 queryFilter += ` DD.DECLARATIONDATE between '` + declarationDate_I + `' and '` + declarationDate_F + `'`;
    //                 queryDynamic += ` and Postingdate between '` + declarationDate_I + `' and '` + declarationDate_F + `'`;
    //                 if (supplier.length === 0) {
    //                     queryDynamic = `Postingdate between '` + declarationDate_I + `' and '` + declarationDate_F + `'`;

    //                 }
    //             }

    //             if (category.length > 0) {
    //                 queryFilter = queryFilter.length > 7 ? queryFilter + " AND " : queryFilter;
    //                 queryFilter += ` DD.PURCHASEORDERITEMCATEGORY = '` + category + `'`;
    //             } else {
    //                 queryFilter += ` AND DD.PURCHASEORDERITEMCATEGORY = ''`;
    //             }
    //             if (purchaseOrder.length > 0) {
    //                 queryFilter = queryFilter.length > 7 ? queryFilter + " AND " : queryFilter;
    //                 queryFilter += ` DD.PURCHASEORDER = '` + purchaseOrder + `'`;
    //                 queryDynamic += ` and Purchaseorder='` + purchaseOrder + `'`;
    //             }
    //             if (companyCode.length > 0) {
    //                 queryFilter = queryFilter.length > 7 ? queryFilter + " AND " : queryFilter;
    //                 queryFilter += ` DD.COMPANYCODE = '` + companyCode + `'`;
    //                 queryDynamic += ` and Companycode='` + companyCode + `'`;
    //             }
    //             if (declarationStatus.length > 0) {
    //                 if (declarationStatus === "V") {
    //                     queryDynamic += ` and Approvalstatus =''`;
    //                 } else if (declarationStatus === "R") {
    //                     queryDynamic += ` and Deletestatus = true`;
    //                 } else {
    //                     queryDynamic += ` and Approvalstatus ='` + declarationStatus + `'`;
    //                 }
    //             }
    //             if (sheetNumber.length > 0) {
    //                 queryFilter = queryFilter.length > 7 ? queryFilter + " AND " : queryFilter;
    //                 queryFilter += ` DD.SHEETNUMBER = '` + sheetNumber + `'`;
    //                 queryDynamic += ` and Serviceentrysheet ='` + sheetNumber + `'`;
    //             }
    //             queryFilter = queryFilter.length > 7 ? queryFilter : "";
    //             query1 += queryFilter;

    //             //resultService.query1 = query1;
    //             //resultService.queryDynamic = queryDynamic;

    //             let PORTAL_PROVEEDORES;

    //             if (category === "9") {
    //                 PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
    //                 try {
    //                     const { ServiceEntrySheetSet } = PORTAL_PROVEEDORES.entities;

    //                     let resultHes = await PORTAL_PROVEEDORES.run(
    //                         SELECT.from(ServiceEntrySheetSet, a => { a(), a.navHesToHesItems(), a.navHesToHesItems2() }).where(queryDynamic)
    //                     );
    //                     resultService.resultHes = resultHes;

    //                     let countApproved = 0;
    //                     let countPendding = 0;
    //                     let countRejected = 0;

    //                     let functionRecorrer = async function (items, i) {
    //                         if (items.length === i) {
    //                             resultService.WidgetCountApproved_Ser = countApproved;
    //                             resultService.WidgetCountPendding_Ser = countPendding;
    //                             resultService.WidgetCountRejected_Ser = countRejected;
    //                             let resultFinal = resultHes;

    //                             if (declarationidentifier.length > 0) {
    //                                 resultFinal = resultHes.filter(function (fg) {
    //                                     return fg.ExtNumber === declarationidentifier;
    //                                 });
    //                             }
    //                             resultService.Data_Ser = resultFinal;
    //                             return resultService;
    //                         } else {
    //                             let item = items[i];
    //                             item.navHesToHesItems = item.navHesToHesItems2;
    //                             item.MotivoRechazo = "";
    //                             item.FechaRechazo = "-";
    //                             item.DescripcionDeclaracion = "";

    //                             if (item.Isdeleted) {
    //                                 if (item.Message.includes("-MOTIVO RECHAZO:")) {
    //                                     let comentario = item.Message.split("-MOTIVO RECHAZO:")[0];
    //                                     let motivoRechazo = item.Message.split("-MOTIVO RECHAZO:")[1];

    //                                     item.MotivoRechazo = motivoRechazo;
    //                                     item.DescripcionDeclaracion = comentario;
    //                                     if (motivoRechazo.includes("-FECHA:")) {
    //                                         let fechaRechazo = motivoRechazo.split("-FECHA:")[1].length === 0 ? "-" : motivoRechazo.split("-FECHA:")[1];
    //                                         item.FechaRechazo = fechaRechazo;
    //                                         item.MotivoRechazo = motivoRechazo.split("-FECHA:")[0];
    //                                     }
    //                                 }
    //                                 countRejected++;
    //                             } else {
    //                                 item.DescripcionDeclaracion = item.Message;

    //                                 if (item.Approvalstatus === "X") {
    //                                     countApproved++;
    //                                 }

    //                                 if (item.Approvalstatus === "") {
    //                                     countPendding++;
    //                                 }
    //                             }

    //                             item.ATTACHMENTS_DECLARATION = [];
    //                             item.ITEMSDELIVERYDECLARATION = [];

    //                             item.DATA_HANA = {
    //                                 DECLARATIONIDENTIFIER: null
    //                             };
    //                             if (item.Serviceentrysheet.length > 0) {
    //                                 let querySelect2 = `SELECT * FROM "` + schemaName + `"."DB_DECLAREDELIVERY" WHERE "SHEETNUMBER" = '` + item.Serviceentrysheet + `'`;
    //                                 let responseSelect2 = await db.run(querySelect2);
    //                                 db.tx().commit();
    //                                 if (responseSelect2.length > 0) {
    //                                     let item2 = responseSelect2[0];
    //                                     item.DECLARATIONIDENTIFIER = item2.DECLARATIONIDENTIFIER;
    //                                     let querySelect1 = `SELECT * FROM "` + schemaName + `"."DB_DOCUMENTSDELIVERYDECLARATION" WHERE "DECLARATIONIDENTIFIER" = ` + item2.DECLARATIONIDENTIFIER;
    //                                     let responseSelect1 = await db.run(querySelect1);

    //                                     db.tx().commit();
    //                                     item.ATTACHMENTS_DECLARATION = responseSelect1;

    //                                     let querySelect3 = `SELECT * FROM "` + schemaName + `"."DB_ITEMSDELIVERYDECLARATION" WHERE "DECLARATIONIDENTIFIER" = ` + item2.DECLARATIONIDENTIFIER;
    //                                     let responseSelect3 = await db.run(querySelect3);
    //                                     db.tx().commit();
    //                                     item.ITEMSDELIVERYDECLARATION = responseSelect3;

    //                                     if (responseSelect3.length > 0) {

    //                                     }

    //                                     if (item.Approvalstatus === "") {
    //                                         item.Serviceentrysheet = "";
    //                                         item2.SHEETNUMBER = "";
    //                                         item2.MESSAGESERVICE = "";
    //                                     }

    //                                     item.DATA_HANA = item2;
    //                                     i++;
    //                                     await functionRecorrer(items, i);
    //                                 } else {

    //                                     if (item.Approvalstatus === "") {
    //                                         item.Serviceentrysheet = "";
    //                                     }

    //                                     i++;
    //                                     await functionRecorrer(items, i);
    //                                 }
    //                             } else {

    //                                 if (item.Approvalstatus === "") {
    //                                     item.Serviceentrysheet = "";
    //                                 }

    //                                 i++;
    //                                 await functionRecorrer(items, i);
    //                             }
    //                         }
    //                     };
    //                     if (resultHes.length > 0) {
    //                         await functionRecorrer(resultHes, 0);
    //                         return resultService;
    //                     } else {
    //                         return resultService;
    //                     }

    //                 } catch (eCC) {
    //                     //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gDeclareDelivery, servicios", detail: JSON.stringify(eCC) });
    //                     //resultService.queryDynamic = queryDynamic;
    //                     //resultService.query1 = query1;
    //                     //resultService.eCC = eCC;
    //                     return resultService;
    //                 }
    //             } else {
    //                 let response1 = await db.run(query1);
    //                 db.tx().commit();
    //                 resultService.WidgetCount_Mat = response1.length;
    //                 try {
    //                     PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
    //                     const { materialDocumentsSet } = PORTAL_PROVEEDORES.entities;
    //                     let queryDynamic2 = "";

    //                     if (supplier.length > 0) {
    //                         queryDynamic2 = `Supplier='` + supplier + `'`;
    //                     }

    //                     if (declarationDate_I.length > 0 && declarationDate_F.length > 0) {
    //                         queryDynamic2 += ` and (Postingdate>='` + declarationDate_I + `' and Postingdate<='` + declarationDate_F + `')`;
    //                         if (supplier.length === 0) {
    //                             queryDynamic2 = `Postingdate>='` + declarationDate_I + `' and Postingdate<='` + declarationDate_F + `'`;
    //                         }
    //                     }

    //                     if (supplier.length > 0) {
    //                         queryDynamic2 += ` and Purchaseorder='` + purchaseOrder + `'`;
    //                         if (queryDynamic2.length === 0) {
    //                             queryDynamic2 = "Purchaseorder=" + purchaseOrder + "'";
    //                         }
    //                     }

    //                     //let resultMIGO = [];
    //                     let resultMIGO = await PORTAL_PROVEEDORES.run(SELECT.from(materialDocumentsSet).where(queryDynamic2));

    //                     let functionRecorrerMigo = async function (items4, i4) {
    //                         if (items4.length === i4) {
    //                             return resultService;
    //                         } else {
    //                             let item4 = items4[i4];
    //                             let json4 = {};

    //                             json4.ATTACHMENTS_DECLARATION = [];
    //                             json4.ITEMSDELIVERYDECLARATION = [];
    //                             json4.DECLARATIONIDENTIFIER = "Generada por Abastible";
    //                             json4.PURCHASEORDER = item4.Purchaseorder;
    //                             json4.COMPANYCODEDESCRIPTION = "Abastible S.A.";
    //                             json4.DESCRIPTIONDECLARATION = "—";
    //                             json4.DECLAREDAMOUNT = item4.AmountText;
    //                             json4.CURRENCY = item4.Currency;
    //                             json4.DECLAREDQUANTITY = "—";
    //                             json4.DECLARATIONDATE = item4.PostingdateText;
    //                             json4.SUPPLIER = item4.Supplier;
    //                             json4.SUPPLIERNAME = "";
    //                             json4.MATERIALDOCUMENT = item4.Materialdocument;
    //                             json4.MATERIALDOCUMENTDATE = item4.PostingdateText; //*
    //                             json4.REFERENCE = item4.Reference;

    //                             try {
    //                                 const { materialDocumentsItemsSet } = PORTAL_PROVEEDORES.entities;
    //                                 let queryDynamic4 = `Purchaseorder = '` + item4.Purchaseorder + `'`;
    //                                 queryDynamic4 += ` and Materialdocument = '` + item4.Materialdocument + `'`;
    //                                 let resultItemsMIGO = await PORTAL_PROVEEDORES.run(
    //                                     SELECT.from(materialDocumentsItemsSet).where(queryDynamic4)
    //                                 );

    //                                 if (resultItemsMIGO.length > 0) {
    //                                     resultItemsMIGO.forEach(function (element4) {
    //                                         json4.ITEMSDELIVERYDECLARATION.push({
    //                                             PURCHASEORDERITEM: element4.Materialdocumentitem,
    //                                             MATERIAL: element4.Material,
    //                                             PURCHASEORDERITEMTEXT: element4.Itemdescription,
    //                                             PURCHASEORDERQUANTITYUNIT: element4.Unit,
    //                                             ORDERQUANTITYTEXT: element4.Quantitytext,
    //                                             DOCUMENTCURRENCY: element4.Currency,
    //                                             INVOICEDECLAREQUANTITY: element4.DeclaredQuantityText,
    //                                             INVOICEQUANTITY: element4.InvoicedQuantityText,
    //                                             NETPRICEAMOUNT: element4.Amounttext,
    //                                             TOTPRICEDECLARE: element4.TotalPriceText,
    //                                             PERCENTAGEDECLARE: element4.PercentageDeclaredText
    //                                         });
    //                                     });
    //                                 }
    //                             } catch (e4) {
    //                             }

    //                             resultService.Data_Mat.push(json4);
    //                             i4++;
    //                             await functionRecorrerMigo(items4, i4);
    //                         }
    //                     };

    //                     let functionRecorrer2 = async function (items2, i2) {
    //                         if (items2.length === i2) {
    //                             return resultService;
    //                         } else {
    //                             let item2 = items2[i2];
    //                             item2.DECLAREDAMOUNT = Number(item2.DECLAREDAMOUNT);
    //                             item2.MATERIALDOCUMENT = "";
    //                             item2.REFERENCE = "";
    //                             item2.ATTACHMENTS_DECLARATION = [];
    //                             item2.ITEMSDELIVERYDECLARATION = [];

    //                             let querySelect2 = `SELECT * FROM "` + schemaName + `"."DB_DOCUMENTSDELIVERYDECLARATION" WHERE "DECLARATIONIDENTIFIER" = ` + item2.DECLARATIONIDENTIFIER;
    //                             let responseSelect2 = await db.run(querySelect2);
    //                             db.tx().commit();
    //                             item2.ATTACHMENTS_DECLARATION = responseSelect2;

    //                             let querySelect4 = `SELECT * FROM "` + schemaName + `"."DB_ITEMSDELIVERYDECLARATION" WHERE "DECLARATIONIDENTIFIER" = ` + item2.DECLARATIONIDENTIFIER;
    //                             let responseSelect4 = await db.run(querySelect4);
    //                             db.tx().commit();

    //                             responseSelect4.forEach(elementF => {
    //                                 elementF.INVOICEDECLAREQUANTITY = Number(elementF.INVOICEDECLAREQUANTITY);
    //                                 elementF.INVOICEQUANTITY = Number(elementF.INVOICEQUANTITY);
    //                                 elementF.NETPRICEAMOUNT = Number(elementF.NETPRICEAMOUNT);
    //                                 elementF.TOTPRICEDECLARE = Number(elementF.TOTPRICEDECLARE);
    //                                 elementF.INVOICEAVAILABLEQUANTITY = Number(elementF.INVOICEAVAILABLEQUANTITY);
    //                             });
    //                             item2.ITEMSDELIVERYDECLARATION = responseSelect4;

    //                             resultService.Data_Mat.push(item2);
    //                             i2++;
    //                             await functionRecorrer2(items2, i2);
    //                         }
    //                     };
    //                     if (response1.length > 0) {
    //                         await functionRecorrer2(response1, 0);
    //                         if (resultMIGO.length > 0) {
    //                             await functionRecorrerMigo(resultMIGO, 0);
    //                         }
    //                         return resultService;
    //                     } else {
    //                         if (resultMIGO.length > 0) {
    //                             await functionRecorrerMigo(resultMIGO, 0);
    //                         }
    //                         return resultService;
    //                     }
    //                 } catch (e) {
    //                     //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gDeclareDelivery, materiales", detail: JSON.stringify(e) });
    //                     // throw new Error(e);
    //                     return res.status(500).json({
    //                         code: 500,
    //                         message: "Ocurrió un error al consultar la información"
    //                     });
    //                 }
    //             }

    //         } else {
    //             //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gDeclareDelivery, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
    //             res.status(400).json({
    //                 code: 303,
    //                 error: validate,
    //                 message: "No fue posible acceder a la información con los datos informados"
    //             });
    //         }
    //     } catch (e) {
    //         //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gDeclareDelivery", detail: JSON.stringify(e) });
    //         // res.status(e.code).json(e);
    //         return res.status(500).json({
    //             code: 500,
    //             message: "Ocurrió un error al consultar la información"
    //         });
    //     }

    // });

    this.on('cDeclareDelivery', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let response = {
                DECLARATIONIDENTIFIER: null,
                SHEETNUMBER: null,
                MESSAGE: "",
                TYPE: "S"
            };
            let param = req.data.input;
            let dataCreate = param.DataCreate;
            let dataECC = param.DataECC;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método cDeclareDelivery, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                return res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                let queryIdentifier = `SELECT D.DECLARATIONIDENTIFIER FROM "` + schemaName + `"."DB_DECLAREDELIVERY" AS D ORDER BY D.DECLARATIONIDENTIFIER DESC`;
                let responseIdentifier = await db.run(queryIdentifier);
                let declarationIdentifier = 2000000000;

                if (responseIdentifier.length > 0) {
                    declarationIdentifier = (responseIdentifier[0].DECLARATIONIDENTIFIER + 1);
                }

                let querySelect1 = `SELECT U.USERID FROM "` + schemaName + `"."DB_USERSMASTER" AS U WHERE "EMAIL" = '` + param.Mail + `'`;
                let responseSelect1 = await db.run(querySelect1);
                db.tx().commit();
                let userid = null;
                if (responseSelect1.length > 0) {
                    userid = responseSelect1[0].USERID;
                    let declarationStatus = '1';
                    let userIto = null;
                    if (dataCreate.PURCHASEORDERITEMCATEGORY === '9') {
                        userIto = dataECC.navHesToSelf.Itousuario;
                        declarationStatus = '2';
                    }

                    let queryInsert1 = `INSERT INTO "` + schemaName + `"."DB_DECLAREDELIVERY"`;
                    queryInsert1 += ` (DECLARATIONIDENTIFIER, PURCHASEORDER, PURCHASEORDERITEM, PURCHASEORDERITEMCATEGORY, PURCHASEORDERITEMCATEGORYTEXT, SERVICEPACKAGE, DATESERVICEPACKAGE, DELIVERYADDRESS, COMPANYCODE, COMPANYCODEDESCRIPTION, DECLAREDAMOUNT, DECLARATIONDATE, DESCRIPTIONDECLARATION, SUPPLIERNAME, SUPPLIER, PLANNEDDATE, CREATEDBYUSER, CREATEDDATE, DECLARATIONSTATUS, SHEETNUMBER, MESSAGESERVICE, REALQUANTITY, PURCHASEORDERITEMTEXT, ITO_USER_ERP)`;
                    queryInsert1 += ` VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`;
                    let responseInsert1 = await db.run(queryInsert1, [declarationIdentifier, dataCreate.PURCHASEORDER, dataCreate.PURCHASEORDERITEM, dataCreate.PURCHASEORDERITEMCATEGORY, dataCreate.PURCHASEORDERITEMCATEGORYTEXT, dataCreate.SERVICEPACKAGE, dataCreate.DATESERVICEPACKAGE, dataCreate.DELIVERYADDRESS, dataCreate.COMPANYCODE, dataCreate.COMPANYCODEDESCRIPTION, dataCreate.DECLAREDAMOUNT, dataCreate.DECLARATIONDATE, dataCreate.DESCRIPTIONDECLARATION, dataCreate.SUPPLIERNAME, dataCreate.SUPPLIER, dataCreate.PLANNEDDATE, userid, dataCreate.CREATEDDATE, declarationStatus, '', '', dataCreate.REALQUANTITY, dataCreate.PURCHASEORDERITEMTEXT, userIto]);
                    db.tx().commit();
                    if (responseInsert1 === 1) {

                        let functionRecorrer = async function (items, i) {
                            if (items.length === i) {
                                response.DECLARATIONIDENTIFIER = declarationIdentifier;

                                if (dataCreate.PURCHASEORDERITEMCATEGORY === '9') {
                                    let idecc = declarationIdentifier.toString();
                                    dataECC.navHesToSelf.ExtNumber = idecc;
                                    response.RESPONSE_ECC = idecc;
                                    const srv = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                                    cds.env.features.fetch_csrf = true;
                                    try {
                                        const resultECC = await srv.send({
                                            method: 'POST',
                                            path: "/ServiceEntrySheetSet",
                                            data: dataECC
                                        });
                                        response.RESPONSE_ECC = resultECC;

                                        try {
                                            response.RESPONSE_ECC = resultECC;
                                            let messECC = "";
                                            let sheetNumber = "";
                                            let staECC = "1";

                                            let succ = resultECC.navHesToResult.filter(function (fs) {
                                                return fs.Type === "S";
                                            });
                                            let err = resultECC.navHesToResult.filter(function (fe) {
                                                return fe.Type === "E";
                                            });

                                            if (succ.length > 0) {
                                                sheetNumber = succ[0].MessageV1;
                                                response.SHEETNUMBER = "OK";
                                                messECC = succ[0].Message;
                                            }

                                            if (err.length > 0) {
                                                staECC = "3";
                                                messECC = err[0].Message;
                                            }

                                            if (response.SHEETNUMBER === "OK") {
                                                try {
                                                    let queryUpdate1 = `UPDATE "` + schemaName + `"."DB_DECLAREDELIVERY" SET SHEETNUMBER = '` + sheetNumber + `', MESSAGESERVICE = '` + messECC + `', DECLARATIONSTATUS = '` + staECC + `' WHERE DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                                                    let responseUpdate1 = await db.run(queryUpdate1);
                                                    db.tx().commit();
                                                    return response;
                                                } catch (nn) {
                                                    //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorSet, conexión OData 3", detail: JSON.stringify(nn) });
                                                    console.error("Error ECC ServiceEntrySheetSet:", nn);
                                                    return res.status(400).json({
                                                        code: 303,
                                                        message: "No fue posible procesar la información"
                                                    });
                                                }
                                            } else {
                                                response.MESSAGE = messECC;
                                                response.TYPE = "E";
                                                let queryDeleteDeclareDelivery = `DELETE FROM "` + schemaName + `"."DB_DECLAREDELIVERY" WHERE DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                                                let responseDeleteDeclare = await db.run(queryDeleteDeclareDelivery);
                                                db.tx().commit();

                                                let queryDeleteItemsDeclareDelivery = `DELETE FROM "` + schemaName + `"."DB_ITEMSDELIVERYDECLARATION" WHERE DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                                                let responseItemsDelete = await db.run(queryDeleteItemsDeclareDelivery);
                                                db.tx().commit();
                                                response.DECLARATIONIDENTIFIER = null;
                                                return response;
                                            }
                                        } catch (pp) {
                                            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método cDeclareDelivery, conexión OData 2", detail: JSON.stringify(pp) });

                                            let queryDynamicECC = `Nro_Externo='` + idecc + `'`;
                                            let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                                            let { checkHesSet } = PORTAL_PROVEEDORES.entities;
                                            let arrayResultECC = await PORTAL_PROVEEDORES.run(SELECT.from(checkHesSet).where(queryDynamicECC));

                                            if (arrayResultECC.length === 0) {

                                                console.error("Error ECC ServiceEntrySheetSet:", pp);
                                                return res.status(400).json({
                                                    code: 303,
                                                    message: "No fue posible procesar la información"
                                                });
                                            } else if (arrayResultECC.length > 0) {
                                                let dataECC = arrayResultECC[0];

                                                if (dataECC.Nro_Hes.length > 0) {
                                                    try {
                                                        let queryUpdate3 = `UPDATE "` + schemaName + `"."DB_DECLAREDELIVERY" SET SHEETNUMBER = '` + dataECC.Nro_Hes + `' WHERE DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                                                        let responseUpdate1 = await db.run(queryUpdate3);
                                                        db.tx().commit();
                                                        response.SHEETNUMBER = "OK";
                                                        response.DECLARATIONIDENTIFIER = declarationIdentifier;
                                                        response.MESSAGE = "";
                                                        response.TYPE = "S";
                                                        return response;
                                                    } catch (nn) {
                                                        //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorSet, conexión OData 3", detail: JSON.stringify(nn) });
                                                        console.error("Error ECC ServiceEntrySheetSet:", nn);
                                                        return res.status(400).json({
                                                            code: 303,
                                                            message: "No fue posible procesar la información"
                                                        });
                                                    }
                                                } else {
                                                    response.MESSAGE = "No fue posible procesar la información";
                                                    response.TYPE = "E";
                                                    let queryDeleteDeclareDelivery = `DELETE FROM "` + schemaName + `"."DB_DECLAREDELIVERY" WHERE DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                                                    let responseDeleteDeclare = await db.run(queryDeleteDeclareDelivery);
                                                    db.tx().commit();

                                                    let queryDeleteItemsDeclareDelivery = `DELETE FROM "` + schemaName + `"."DB_ITEMSDELIVERYDECLARATION" WHERE DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                                                    let responseItemsDelete = await db.run(queryDeleteItemsDeclareDelivery);
                                                    db.tx().commit();
                                                    response.DECLARATIONIDENTIFIER = null;
                                                    return response;
                                                }

                                            }

                                        }
                                    } catch (aa) {

                                        let queryDynamicECC = `Nro_Externo='` + idecc + `'`;
                                        let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                                        let { checkHesSet } = PORTAL_PROVEEDORES.entities;
                                        let arrayResultECC = await PORTAL_PROVEEDORES.run(SELECT.from(checkHesSet).where(queryDynamicECC));

                                        if (arrayResultECC.length === 0) {

                                            console.error("Error ECC ServiceEntrySheetSet:", aa);
                                            return res.status(400).json({
                                                code: 303,
                                                message: "No fue posible procesar la información"
                                            });
                                        } else if (arrayResultECC.length > 0) {
                                            let dataECC = arrayResultECC[0];

                                            if (dataECC.Nro_Hes.length > 0) {
                                                try {
                                                    let queryUpdate3 = `UPDATE "` + schemaName + `"."DB_DECLAREDELIVERY" SET SHEETNUMBER = '` + dataECC.Nro_Hes + `' WHERE DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                                                    let responseUpdate1 = await db.run(queryUpdate3);
                                                    db.tx().commit();
                                                    response.SHEETNUMBER = "OK";
                                                    response.DECLARATIONIDENTIFIER = declarationIdentifier;
                                                    response.MESSAGE = "";
                                                    response.TYPE = "S";
                                                    return response;
                                                } catch (nn) {
                                                    //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gVendorSet, conexión OData 3", detail: JSON.stringify(nn) });
                                                    console.error("Error ECC ServiceEntrySheetSet:", nn);
                                                    return res.status(400).json({
                                                        code: 303,
                                                        message: "No fue posible procesar la información"
                                                    });
                                                }

                                            } else {
                                                response.MESSAGE = "No fue posible procesar la información";
                                                response.TYPE = "E";
                                                let queryDeleteDeclareDelivery = `DELETE FROM "` + schemaName + `"."DB_DECLAREDELIVERY" WHERE DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                                                let responseDeleteDeclare = await db.run(queryDeleteDeclareDelivery);
                                                db.tx().commit();

                                                let queryDeleteItemsDeclareDelivery = `DELETE FROM "` + schemaName + `"."DB_ITEMSDELIVERYDECLARATION" WHERE DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                                                let responseItemsDelete = await db.run(queryDeleteItemsDeclareDelivery);
                                                db.tx().commit();
                                                response.DECLARATIONIDENTIFIER = null;
                                                return response;
                                            }

                                        }

                                    }
                                } else {
                                    return response;
                                }
                            } else {
                                let param2 = items[i];
                                let queryItemsIdentifier = `SELECT I.ITEMSDELIVERYDECLARATIONIDENTIFIER FROM "` + schemaName + `"."DB_ITEMSDELIVERYDECLARATION" AS I ORDER BY I.ITEMSDELIVERYDECLARATIONIDENTIFIER DESC`;
                                let responseItemsIdentifier = await db.run(queryItemsIdentifier);
                                let ItemsDeclarationIdentifier = 1;

                                if (responseItemsIdentifier.length > 0) {
                                    ItemsDeclarationIdentifier = (responseItemsIdentifier[0].ITEMSDELIVERYDECLARATIONIDENTIFIER + 1);
                                }

                                let queryInsert2 = `INSERT INTO "` + schemaName + `"."DB_ITEMSDELIVERYDECLARATION"`
                                queryInsert2 += ` (ITEMSDELIVERYDECLARATIONIDENTIFIER, DECLARATIONIDENTIFIER, PURCHASEORDERITEM, MATERIAL, PURCHASEORDERITEMTEXT, PURCHASEORDERQUANTITYUNIT, DOCUMENTCURRENCY, ORDERQUANTITYTEXT, INVOICEAVAILABLEQUANTITY, INVOICEDECLAREQUANTITY, INVOICEQUANTITY, NETPRICEAMOUNT, TOTPRICEDECLARE, PERCENTAGEDECLARE)`;
                                queryInsert2 += ` VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;
                                let responseInsert2 = await db.run(queryInsert2, [ItemsDeclarationIdentifier, declarationIdentifier, param2.PURCHASEORDERITEM, param2.MATERIAL, param2.PURCHASEORDERITEMTEXT, param2.PURCHASEORDERQUANTITYUNIT, param2.DOCUMENTCURRENCY, param2.ORDERQUANTITYTEXT, param2.INVOICEAVAILABLEQUANTITY, param2.INVOICEDECLAREQUANTITY, param2.INVOICEQUANTITY, param2.NETPRICEAMOUNT, param2.TOTPRICEDECLARE, param2.PERCENTAGEDECLARE]);
                                db.tx().commit();
                                i++;
                                await functionRecorrer(items, i);
                            }
                        };

                        if (dataCreate.ITEMSDELIVERYDECLARATION.length > 0) {
                            await functionRecorrer(dataCreate.ITEMSDELIVERYDECLARATION, 0);
                            return response;
                        } else {
                            return res.status(400).json({
                                code: 303,
                                // error: validate,
                                message: "No fue posible procesar la información con los datos informados"
                            });
                        }

                    } else {
                        return res.status(400).json({
                            code: 303,
                            // error: validate,
                            message: "No fue posible procesar la información con los datos informados"
                        });
                    }
                }
                return response;
            } else {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método cDeclareDelivery, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                // throw new Error(e);
            }
        } catch (e) {
            console.error("Error cDeclareDelivery:");

            return res.status(500).json({
                code: 500,
                message: "Error interno procesando la declaración"
            });
        }
    });

    this.on('cAttachmentsDeclareDelivery', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let response = {
                MESSAGE: "",
                TYPE: "S"
            };
            let arrayResults = [];
            let param = req.data.input;
            let declarationIdentifier = param.DeclarationIdentifier;
            let dataAttachments = param.DataAttachments;
            let sheetNumber = null;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método cAttachmentsDeclareDelivery, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                let functionRecorrer = async function (items, i) {
                    if (items.length === i) {
                        response.MESSAGE = JSON.stringify(arrayResults);
                        return response;
                    } else {
                        let param = items[i];
                        const srv = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                        cds.env.features.fetch_csrf = true;
                        let base64 = param.base64.split(",")[1];
                        try {

                            let queryIdentifier = `SELECT D.DOCUMENTSIDENTIFIER FROM "` + schemaName + `"."DB_DOCUMENTSDELIVERYDECLARATION" AS D ORDER BY D.DOCUMENTSIDENTIFIER DESC`;
                            let responseIdentifier = await db.run(queryIdentifier);
                            let documentsIdentifier = 30000;

                            if (responseIdentifier.length > 0) {
                                documentsIdentifier = (responseIdentifier[0].DOCUMENTSIDENTIFIER + 1);
                            }
                            let slug = sheetNumber + ";" + documentsIdentifier + ";" + encodeURIComponent(param.name);

                            const resultECC = await srv.send({
                                method: 'POST',
                                path: "/uploadEntrySheetFileSet",
                                data: base64,
                                headers: {
                                    'content-type': param.type,
                                    'slug': slug
                                }
                            });

                            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_DOCUMENTSDELIVERYDECLARATION"(DOCUMENTSIDENTIFIER, DECLARATIONIDENTIFIER, NAME, SIZE, DATEUPLOAD, TYPE, DELETESTATUS) VALUES($1, $2, $3, $4, $5, $6, $7)`;
                            let responseInsert = await db.run(queryInsert, [documentsIdentifier, declarationIdentifier, param.name, param.size, param.dateUpload, param.type, "1"]);
                            db.tx().commit();

                            arrayResults.push(resultECC);
                            i++;
                            await functionRecorrer(items, i);
                        } catch (errorFile) {
                            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método cAttachmentsDeclareDelivery, conexión OData", detail: JSON.stringify(errorFile) });
                            console.error("Error en uploadEntrySheetFileSet");
                            // arrayResults.push(errorFile);
                            arrayResults.push({
                                TYPE: "E",
                                MESSAGE: "No fue posible cargar el archivo."
                            });
                            i++;
                            await functionRecorrer(items, i);
                        }
                    }
                };

                if (dataAttachments.length > 0) {

                    let querySelect1 = `SELECT DD.SHEETNUMBER FROM "` + schemaName + `"."DB_DECLAREDELIVERY" AS DD WHERE DD.DECLARATIONIDENTIFIER = ` + declarationIdentifier;
                    let responseSelect1 = await db.run(querySelect1);
                    db.tx().commit();
                    if (responseSelect1.length > 0) {
                        sheetNumber = responseSelect1[0].SHEETNUMBER;
                        await functionRecorrer(dataAttachments, 0);
                        return response;
                    } else {
                        res.status(400).json({
                            code: 303,
                            error: validate,
                            message: "No fue posible procesar la información con los datos informados"
                        });
                    }
                } else {
                    res.status(400).json({
                        code: 303,
                        error: validate,
                        message: "No fue posible procesar la información con los datos informados"
                    });
                }
                return response;
            } else {
                //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método cAttachmentsDeclareDelivery, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible procesar la información con los datos informados"
                });
            }
        } catch (e) {
            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método cAttachmentsDeclareDelivery", detail: JSON.stringify(e) });
            console.error("Error interno en cAttachmentsDeclareDelivery");
            // res.status(e.code).json(e);
            return res.status(500).json({
                code: 500,
                message: "Error interno"
            });
        }
    });
    this.on('gFAQ', async req => {
        //key id int question 999 answer 999 deleteStatus 1
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let query = `SELECT`;
            query += ` U.ID, U.QUESTION, U.ANSWER, U.TYPE, U.DELETESTATUS, SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_FAQ" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.ID DESC; `;
            let response1 = await db.run(query);
            let response2 = await db.run(query);
            db.tx().commit();
            let array_type = await eliminaDuplicado(response1, "TYPE");
            let functionRecorrer = async function (items, i) {
                if (items.length === i) {
                    array_type = array_type.sort((a, b) => {
                        if (a.TYPE < b.TYPE) {
                            return -1;
                        }
                    });
                    return array_type;
                } else {
                    let item = items[i];
                    let array_questions = response2.filter(function (f1) {
                        return f1.TYPE === item.TYPE;
                    });
                    item.PREGUNTAS = array_questions;
                    item.COUNT_PREGUNTAS = array_questions.length;
                    delete item.ID;
                    delete item.QUESTION;
                    delete item.DELETESTATUS_DESCRIPTION;
                    delete item.ANSWER;
                    delete item.DELETESTATUS;
                    i++;
                    await functionRecorrer(items, i);
                }
            }
            await functionRecorrer(array_type, 0);
            return array_type;
        } catch (e) {
            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gFAQ", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });
    this.on('gFAQLaunchpad', async req => {
        //key id int question 999 answer 999 deleteStatus 1
        let { res } = req.http;
        try {
            let param = req.data.input;
            let query = `SELECT`;
            query += ` U.ID, U.QUESTION, U.ANSWER, U.TYPE, U.DELETESTATUS, SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_FAQ" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.ID DESC; `;
            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('cFAQ', async req => {
        //key id int question 999 answer 999 deleteStatus 1
        let { res } = req.http;
        try {
            let queryId = `SELECT U.ID FROM "` + schemaName + `"."DB_FAQ" AS U ORDER BY U.ID DESC`;
            let responseId = await db.run(queryId);
            let id = 1;

            if (responseId.length > 0) {
                id = (responseId[0].ID + 1);
            }

            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_FAQ"(ID, QUESTION, ANSWER, TYPE, DELETESTATUS) VALUES($1, $2, $3, $4, $5)`;
            let responseInsert = await db.run(queryInsert, [id, param.QUESTION, param.ANSWER, param.TYPE, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_add_message,
                data: {}
            };
            if (responseInsert === 1) {
                outMessage.code = 200;
                outMessage.message = add_message + " en la tabla DB_FAQ";
                outMessage.data = await getRegister("DB_FAQ", "ID", id);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('uFAQ', async req => {
        //key id int question 999 answer 999 deleteStatus 1
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_FAQ" SET ID = $1, QUESTION = $2, ANSWER = $3, TYPE = $4, DELETESTATUS = $5 WHERE "ID" = $1`;
            let responseUpdate = await db.run(queryUpdate, [param.ID, param.QUESTION, param.ANSWER, param.TYPE, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_update_message,
                data: {}
            };
            if (responseUpdate === 1) {
                outMessage.code = 200;
                outMessage.message = update_message + " en la tabla DB_FAQ";
                outMessage.data = await getRegister("DB_FAQ", "ID", param.ID);
            }
            return outMessage;

        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('pNotificacionSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            let proveedor = await getSupplierForSecret(param);
            let idgenerico = param.Idgenerico;
            let tipogenerico = "03";
            let oc = param.Oc;
            //let tokenSession = await getTokenSessionForCookies(req);
            //param.TokenSession = tokenSession;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (proveedor.length > 0 && idgenerico.length > 0 && oc.length > 0) {
                    let queryDynamic = `Proveedor = '` + proveedor + `'`;
                    queryDynamic += ` and Idgenerico = '` + idgenerico + `'`;
                    queryDynamic += ` and Tipogenerico = '` + tipogenerico + `'`;
                    queryDynamic += ` and Oc = '` + oc + `' `;
                    try {
                        let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                        let { notificacionSet } = PORTAL_PROVEEDORES.entities;
                        let arrayResult = await PORTAL_PROVEEDORES.run(SELECT.from(notificacionSet).where(queryDynamic));
                        return arrayResult;
                    } catch (ee) {
                        res.status(ee.code).json(ee);
                    }
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible procesar la información con los datos informados"
                });
            }
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gNotificationsControl', async req => {
        //key id int functionality 100 SENDMAILFLAG 1 SENDPORTALFLAG 1 sendOrigin 10 deleteStatus 1
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let query = `SELECT`;
            query += ` U.ID, U.FUNCTIONALITY, U.SENDMAILFLAG, U.SENDPORTALFLAG, U.SENDORIGIN, U.DELETESTATUS, SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_NOTIFICATIONSCONTROL" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS ORDER BY U.ID DESC; `;
            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            //let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gNotificationsControl", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });
    this.on('cNotificationsControl', async req => {
        //key id int functionality 100 SENDMAILFLAG 1 SENDPORTALFLAG 1 sendOrigin 10 deleteStatus 1
        let { res } = req.http;
        try {

            let queryId = `SELECT U.ID FROM "` + schemaName + `"."DB_NOTIFICATIONSCONTROL" AS U ORDER BY U.ID DESC`;
            let responseId = await db.run(queryId);
            let id = 1;

            if (responseId.length > 0) {
                id = (responseId[0].ID + 1);
            }

            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_NOTIFICATIONSCONTROL"(ID, FUNCTIONALITY, SENDMAILFLAG, SENDPORTALFLAG, SENDORIGIN, DELETESTATUS) VALUES($1, $2, $3, $4, $5, $6)`;
            let responseInsert = await db.run(queryInsert, [id, param.FUNCTIONALITY, param.SENDMAILFLAG, param.SENDPORTALFLAG, param.SENDORIGIN, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_add_message,
                data: {}
            };
            if (responseInsert === 1) {
                outMessage.code = 200;
                outMessage.message = add_message + " en la tabla DB_NOTIFICATIONSCONTROL";
                outMessage.data = await getRegister("DB_NOTIFICATIONSCONTROL", "ID", id);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });
    this.on('uNotificationsControl', async req => {
        //key id int functionality 100 SENDMAILFLAG 1 SENDPORTALFLAG 1 sendOrigin 10 deleteStatus 1
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_NOTIFICATIONSCONTROL" SET ID = $1, FUNCTIONALITY = $2, SENDMAILFLAG = $3, SENDPORTALFLAG = $4, SENDORIGIN = $5, DELETESTATUS = $6 WHERE "ID" = $1`;
            let responseUpdate = await db.run(queryUpdate, [param.ID, param.FUNCTIONALITY, param.SENDMAILFLAG, param.SENDPORTALFLAG, param.SENDORIGIN, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_update_message,
                data: {}
            };
            if (responseUpdate === 1) {
                outMessage.code = 200;
                outMessage.message = update_message + " en la tabla DB_NOTIFICATIONSCONTROL";
                outMessage.data = await getRegister("DB_NOTIFICATIONSCONTROL", "ID", param.ID);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('gUserNotifications', async req => {

        //key id int key vendorID 20 movement 20 notificationDate message 250 viewedFlag 1

        let { res } = req.http;
        let cookieBase = await setCookieBase(req);

        try {
            let param = req.data.input;
            let notificationDate = param.NotificationDate;

            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;

            let validate = await validateSession(param, req);

            if (validate === "DURATION") {
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }

            param.Mail = await getMailForSecret(param);
            param.Supplier = await getSupplierForSecret(param);

            if (validate === "OK") {

                const responseSelect1 = await SELECT
                    .from('DB_USERSMASTER')
                    .columns('USERID')
                    .where({
                        EMAIL: param.Mail
                    });

                if (responseSelect1.length > 0) {

                    let userId = responseSelect1[0].USERID;
                    let supplier = Number(param.Supplier).toString();

                    const notificationLog = await SELECT
                        .from('DB_NOTIFICATIONLOG')
                        .columns('IDNOTIFICATIONS')
                        .where({
                            USERID: userId
                        });

                    const notificationIds = notificationLog.map(item => item.IDNOTIFICATIONS);

                    let responseNoLeidos = [];
                    let responseLeidos = [];

                    const notificationWhere = {
                        VENDORID: {
                            in: [
                                param.Supplier,
                                supplier
                            ]
                        },
                        NOTIFICATIONDATE: {
                            '>=': notificationDate
                        }
                    };

                    if (notificationIds.length > 0) {

                        responseNoLeidos = await SELECT
                            .from('DB_NOTIFICATIONS')
                            .columns([
                                'ID',
                                'VENDORID',
                                'MOVEMENT',
                                'DOCUMENT',
                                'SCENARIO',
                                'NOTIFICATIONDATE',
                                'MESSAGE'
                            ])
                            .columns({
                                val: 0,
                                as: 'VIEW_USER'
                            })
                            .where({
                                ...notificationWhere,
                                ID: {
                                    'not in': notificationIds
                                }
                            })
                            .orderBy('NOTIFICATIONDATE desc');

                        responseLeidos = await SELECT
                            .from('DB_NOTIFICATIONS')
                            .columns([
                                'ID',
                                'VENDORID',
                                'MOVEMENT',
                                'DOCUMENT',
                                'SCENARIO',
                                'NOTIFICATIONDATE',
                                'MESSAGE'
                            ])
                            .columns({
                                val: 1,
                                as: 'VIEW_USER'
                            })
                            .where({
                                ...notificationWhere,
                                ID: {
                                    in: notificationIds
                                }
                            })
                            .orderBy('NOTIFICATIONDATE desc');

                    } else {

                        responseNoLeidos = await SELECT
                            .from('DB_NOTIFICATIONS')
                            .columns([
                                'ID',
                                'VENDORID',
                                'MOVEMENT',
                                'DOCUMENT',
                                'SCENARIO',
                                'NOTIFICATIONDATE',
                                'MESSAGE'
                            ])
                            .columns({
                                val: 0,
                                as: 'VIEW_USER'
                            })
                            .where(notificationWhere)
                            .orderBy('NOTIFICATIONDATE desc');
                    }

                    let response = [];

                    response.push(...responseNoLeidos);
                    response.push(...responseLeidos);

                    return {
                        COUNT_NOTIFICATIONS: responseNoLeidos.length,
                        NOTIFICATIONS: response
                    };

                } else {
                    return res.status(400).json({
                        code: 303,
                        error: validate,
                        message: "No fue posible obtener la información con los datos informados"
                    });
                }

            } else {
                return res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible obtener la información con los datos informados"
                });
            }

        } catch (e) {
            return res.status(500).json({
                message: "No fue posible obtener la información con los datos informados"
            });
        }
    });

    // this.on('gUserNotifications', async req => {
    //     //key id int key vendorID 20 movement 20 notificationDate message 250 viewedFlag 1
    //     let { res } = req.http;
    //     let cookieBase = await setCookieBase(req);
    //     try {
    //         let param = req.data.input;
    //         let notificationDate = param.NotificationDate;
    //         let tokenSession = await getTokenSessionForCookies(req);
    //         param.TokenSession = tokenSession;
    //         let validate = await validateSession(param, req);
    //         if (validate === "DURATION") {
    //             ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gUserNotifications, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
    //             res.status(400).json({
    //                 code: 305,
    //                 message: "El tiempo de la sesion ha expirado"
    //             });
    //         }
    //         param.Mail = await getMailForSecret(param);
    //         param.Supplier = await getSupplierForSecret(param);
    //         if (validate === "OK") {
    //             let querySelect1 = `SELECT U.USERID FROM "` + schemaName + `"."DB_USERSMASTER" AS U WHERE "EMAIL" = '` + param.Mail + `'`;
    //             let responseSelect1 = await db.run(querySelect1);
    //             db.tx().commit();
    //             if (responseSelect1.length > 0) {
    //                 let userId = responseSelect1[0].USERID;
    //                 let supplier = Number(param.Supplier).toString();
    //                 let queryS = `SELECT`;
    //                 let query1 = ` U.ID, U.VENDORID, U.MOVEMENT, U.DOCUMENT, U.SCENARIO, U.NOTIFICATIONDATE, U.MESSAGE, `;
    //                 let vu = ` (1) AS VIEW_USER`;
    //                 let nvu = ` (0) AS VIEW_USER`;
    //                 let query2 = ` FROM "` + schemaName + `"."DB_NOTIFICATIONS" AS U`;
    //                 let query3 = ` WHERE(U.VENDORID = '` + param.Supplier + `' OR U.VENDORID = '` + supplier + `') AND ID`;
    //                 let ni = ` NOT IN `;
    //                 let i = ` IN`;
    //                 let query4 = ` (SELECT NL.IDNOTIFICATIONS FROM "` + schemaName + `"."DB_NOTIFICATIONLOG" AS NL WHERE NL.USERID = ` + userId + `)`;
    //                 let query5 = ` AND U.NOTIFICATIONDATE >= CAST('` + notificationDate + `' as date)`;
    //                 let query6 = ` ORDER BY U.NOTIFICATIONDATE DESC; `;

    //                 let queryIn = queryS + query1 + nvu + query2 + query3 + ni + query4 + query5 + query6;
    //                 let queryNotIn = queryS + query1 + vu + query2 + query3 + i + query4 + query5 + query6;
    //                 let responseLeidos = await db.run(queryNotIn);
    //                 let responseNoLeidos = await db.run(queryIn);
    //                 db.tx().commit();
    //                 let response = [];
    //                 response.push(...responseNoLeidos);
    //                 response.push(...responseLeidos);
    //                 return {
    //                     COUNT_NOTIFICATIONS: responseNoLeidos.length,
    //                     NOTIFICATIONS: response
    //                 };
    //             } else {
    //                 res.status(400).json({
    //                     code: 303,
    //                     error: validate,
    //                     message: "No fue posible obtener la información con los datos informados"
    //                 });
    //             }
    //         } else {
    //             ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gUserNotifications, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
    //             res.status(400).json({
    //                 code: 303,
    //                 error: validate,
    //                 message: "No fue posible obtener la información con los datos informados"
    //             });
    //         }
    //     } catch (e) {
    //         ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gUserNotifications", detail: JSON.stringify(e) });
    //         res.status(e.code).json(e);
    //     }
    // });

    this.on('uUserNotifications', async req => {
        //key id int key vendorID 20 movement 20 notificationDate message 250 viewedFlag 1
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let notificationDate = param.NotificationDate;
            let notificationDateSl = param.NotificationDateSl;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uUserNotifications, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK" && notificationDate.length > 0) {
                param.Mail = await getMailForSecret(param);
                param.Supplier = await getSupplierForSecret(param);
                let querySelect1 = `SELECT U.USERID FROM "` + schemaName + `"."DB_USERSMASTER" AS U WHERE "EMAIL" = '` + param.Mail + `'`;
                let responseSelect1 = await db.run(querySelect1);
                db.tx().commit();

                if (responseSelect1.length > 0) {
                    let userId = responseSelect1[0].USERID;
                    let supplier = Number(param.Supplier).toString();
                    let queryS = `SELECT`;
                    let query1 = ` U.ID, U.VENDORID, U.MOVEMENT, U.DOCUMENT, U.SCENARIO, U.NOTIFICATIONDATE, U.MESSAGE`;
                    let query2 = ` FROM "` + schemaName + `"."DB_NOTIFICATIONS" AS U`;
                    let query3 = ` WHERE(U.VENDORID = '` + param.Supplier + `' OR U.VENDORID = '` + supplier + `') AND ID`;
                    let ni = ` NOT IN`;
                    let query4 = ` (SELECT NL.IDNOTIFICATIONS FROM "` + schemaName + `"."DB_NOTIFICATIONLOG" AS NL WHERE NL.USERID = ` + userId + `)`;
                    let query5 = ` AND U.NOTIFICATIONDATE >= CAST('` + notificationDateSl + `' as date)`;
                    let query6 = ` ORDER BY U.NOTIFICATIONDATE DESC; `;

                    let queryIn = queryS + query1 + query2 + query3 + ni + query4 + query5 + query6;
                    let responseLeidos = await db.run(queryIn);
                    db.tx().commit();
                    let status = "";

                    let functionRecorrer = async function (items, i) {
                        if (items.length === i) {
                            status = "OK";
                            return;
                        } else {
                            let item = items[i];

                            let queryId = `SELECT U.ID FROM "` + schemaName + `"."DB_NOTIFICATIONLOG" AS U ORDER BY U.ID DESC`;
                            let responseId = await db.run(queryId);
                            let id = 1;

                            if (responseId.length > 0) {
                                id = (responseId[0].ID + 1);
                            }

                            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_NOTIFICATIONLOG"(ID, IDNOTIFICATIONS, USERID, NOTIFICATIONLOGDATE) VALUES($1, $2, $3, $4)`;
                            let responseInsert = await db.run(queryInsert, [id, item.ID, userId, notificationDate]);
                            db.tx().commit();

                            i++;
                            await functionRecorrer(items, i);
                        }
                    };
                    await functionRecorrer(responseLeidos, 0);

                    return { "message": status };
                } else {
                    res.status(400).json({
                        code: 303,
                        error: validate,
                        message: "No fue posible obtener la información con los datos informados"
                    });
                }
            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible obtener la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uUserNotifications", detail: JSON.stringify(e) });
            throw new Error(e);
        }
    });

    this.on('cNotifications', async req => {
        //key id int key vendorID 20 movement 20 notificationDate message 250 viewedFlag 1
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {

            let queryId = `SELECT U.ID FROM "` + schemaName + `"."DB_NOTIFICATIONS" AS U ORDER BY U.ID DESC`;
            let responseId = await db.run(queryId);
            let id = 1;

            if (responseId.length > 0) {
                id = (responseId[0].ID + 1);
            }

            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_NOTIFICATIONS"(ID, VENDORID, MOVEMENT, DOCUMENT, SCENARIO, NOTIFICATIONDATE, MESSAGE, VIEWEDFLAG) VALUES($1, $2, $3, $4, $5, $6, $7, $8)`;
            let responseInsert = await db.run(queryInsert, [id, param.VENDORID, param.MOVEMENT, param.DOCUMENT, param.SCENARIO, param.NOTIFICATIONDATE, param.MESSAGE, param.VIEWEDFLAG]);
            db.tx().commit();
            return responseInsert;
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método cNotifications", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });
    this.on('uNotifications', async req => {
        //key id int key vendorID 20 movement 20 notificationDate message 250 viewedFlag 1
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_NOTIFICATIONS" SET ID = $1, VENDORID = $2, MOVEMENT = $3, DOCUMENT = $4, SCENARIO = $5, NOTIFICATIONDATE = $6, MESSAGE = $7, VIEWEDFLAG = $8 WHERE "ID" = $1 AND VENDORID = $2`;
            let responseUpdate = await db.run(queryUpdate, [param.ID, param.VENDORID, param.MOVEMENT, param.DOCUMENT, param.SCENARIO, param.NOTIFICATIONDATE, param.MESSAGE, param.VIEWEDFLAG]);
            db.tx().commit();
            return responseUpdate;
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método uNotifications", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('cAttachmentsPurchaseOrder', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let response = {
                MESSAGE: "",
                TYPE: "S"
            };
            let arrayResults = [];
            let param = req.data.input;
            let declarationIdentifier = param.DeclarationIdentifier;
            let dataAttachments = param.DataAttachments;
            let purchaseOrder = null;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            let validate = await validateSession(param, req);

            if (validate === "DURATION") {
                return res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }

            if (validate === "OK") {
                if (!dataAttachments || dataAttachments.length === 0) {
                    return res.status(400).json({
                        code: 303,
                        message: "No se enviaron archivos"
                    });
                }
                let querySelect1 = `SELECT DD.PURCHASEORDER FROM "` + schemaName + `"."DB_DECLAREDELIVERY" AS DD WHERE DD.DECLARATIONIDENTIFIER = ${declarationIdentifier}`;
                let responseSelect1 = await db.run(querySelect1);
                db.tx().commit();

                if (responseSelect1.length === 0) {
                    return res.status(400).json({
                        code: 303,
                        message: "No fue posible procesar la información"
                    });
                }
                purchaseOrder = responseSelect1[0].PURCHASEORDER;
                const srv = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                cds.env.features.fetch_csrf = true;

                for (let file of dataAttachments) {
                    try {
                        if (!file.base64 || !file.base64.startsWith("data:")) {
                            throw new Error("Formato base64 inválido");
                        }
                        const base64Data = file.base64.split(",")[1];
                        const buffer = Buffer.from(base64Data, 'base64');

                        if (buffer.length > 5000000) {
                            throw new Error(`Archivo muy grande: ${file.name}`);
                        }
                        const fileType = await FileType.fileTypeFromBuffer(buffer);

                        if (!fileType) {
                            throw new Error("No se pudo determinar el tipo de archivo");
                        }
                        const allowedTypes = ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"];

                        if (!allowedTypes.includes(fileType.ext)) {
                            throw new Error(`Tipo de archivo no permitido: ${fileType.ext}`);
                        }
                        let safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
                        let ext = safeName.split('.').pop().toLowerCase();

                        if (ext !== fileType.ext) {
                            throw new Error("Extensión no coincide con el contenido real");
                        }

                        const content = buffer.toString('utf8');

                        if (content.includes("<script") || content.includes("<?php")) {
                            throw new Error("Archivo contiene código potencialmente malicioso");
                        }

                        //ECC
                        let queryIdentifier = `SELECT D.DOCUMENTSIDENTIFIER FROM "` + schemaName + `"."DB_DOCUMENTSDELIVERYDECLARATION" AS D ORDER BY D.DOCUMENTSIDENTIFIER DESC`;
                        let responseIdentifier = await db.run(queryIdentifier);
                        let documentsIdentifier = 30000;
                        if (responseIdentifier.length > 0) {
                            documentsIdentifier = (responseIdentifier[0].DOCUMENTSIDENTIFIER + 1);
                        }
                        let slug = purchaseOrder + ";" + documentsIdentifier + ";" + encodeURIComponent(safeName);

                        const resultECC = await srv.send({
                            method: 'POST',
                            path: "/PurchaseOrderFileCollection",
                            data: base64Data,
                            headers: {
                                'content-type': fileType.mime,
                                'slug': slug
                            }
                        });

                        let queryInsert = `INSERT INTO "` + schemaName + `"."DB_DOCUMENTSDELIVERYDECLARATION"
                    (DOCUMENTSIDENTIFIER, DECLARATIONIDENTIFIER, NAME, SIZE, DATEUPLOAD, TYPE, DELETESTATUS)
                    VALUES($1, $2, $3, $4, $5, $6, $7)`;

                        await db.run(queryInsert, [
                            documentsIdentifier,
                            declarationIdentifier,
                            safeName,
                            buffer.length,
                            file.dateUpload,
                            fileType.mime,
                            "1"
                        ]);

                        db.tx().commit();

                        arrayResults.push(resultECC);

                    } catch (errorFile) {
                        console.error("Error cAttachmentsPurchaseOrder:");
                        return res.status(400).json({
                            code: 303,
                            message: "No fue posible procesar el archivo informado"
                        });
                    }
                }
                response.MESSAGE = JSON.stringify(arrayResults);
                return response;
            } else {
                return res.status(400).json({
                    code: 303,
                    message: "Sesión inválida"
                });
            }
        } catch (e) {

            console.error("Error interno en cAttachmentsPurchaseOrder:");
            return res.status(500).json({
                message: "Error interno procesando archivos"
            });
        }
    });

    this.on('gParametersPortal', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);

        try {
            let param = req.data.input;
            let key = param.KEY_VIEW;

            let validateCookies = await ValidateCookiesReq({ req: req, validate_token: false });
            if (validateCookies.resolve) {
                let queryWhere = ' WHERE';
                if (key.length > 0) {
                    queryWhere = ` WHERE U.KEY_VIEW = '` + key + `' AND`;
                }
                if (key === "PORTAL_FOOTER") {
                    queryWhere = ` WHERE U.KEY_VIEW = 'URL_ENCUESTA_DE_SATISFACCION_PORTAL' OR U.KEY_VIEW = 'URL_LOGO_BLANCO_FOOTER_PORTAL' OR U.KEY_VIEW = 'URL_LOGO_HEADER_PORTAL' OR U.KEY_VIEW = 'URL_INSTAGRAM_PORTAL' OR U.KEY_VIEW = 'URL_YOUTUBE_PORTAL' OR U.KEY_VIEW = 'URL_FACEBOOK_PORTAL' OR U.KEY_VIEW = 'URL_LINKEDIN_PORTAL' OR U.KEY_VIEW = 'URL_TIKTOK_PORTAL' OR U.KEY_VIEW = 'URL_NORMATIVA_PROVEEDORES_PORTAL' OR U.KEY_VIEW = 'URL_TERMINOS_Y_CONDICIONES_PORTAL' OR U.KEY_VIEW = 'CORREO_CONTACTO_PORTAL' OR U.KEY_VIEW = 'URL_BACKGROUND_MENU_MORE_VENDORS' AND`;
                }

                if (key === "PORTAL_DURATION") {
                    queryWhere = ` WHERE U.KEY_VIEW = 'SESSION_DURATION_IN_MILLISECONDS_PORTAL' OR U."KEY_VIEW" = 'INACTIVITY_DURATION_IN_MILLISECONDS_PORTAL' AND`;
                }
                queryWhere += ` U.DELETESTATUS = '1'`;
                let query = `SELECT`;
                query += ` U.KEY_VIEW, U.VALUE_VIEW, U.DESCRIPTION, U.DELETESTATUS, SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
                query += ` FROM "` + schemaName + `"."DB_PARAMETERS" AS U`;
                query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS`;
                query += queryWhere;
                let response1 = await db.run(query);
                db.tx().commit();
                return response1;
            } else {
                return { message: "ERROR" };
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gParametersPortal", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }

    });



    this.on('gParameters', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let key = param.KEY_VIEW;

            let queryWhere = '';
            if (key.length > 0) {
                queryWhere = ` WHERE U.KEY_VIEW = '` + key + `'`;
            }
            //queryWhere += ` U.DELETESTATUS = '1'`;
            let query = `SELECT`;
            query += ` U.KEY_VIEW, U.VALUE_VIEW, U.DESCRIPTION, U.DELETESTATUS, SD.DESCRIPTION AS DELETESTATUS_DESCRIPTION`;
            query += ` FROM "` + schemaName + `"."DB_PARAMETERS" AS U`;
            query += ` INNER JOIN "` + schemaName + `"."DB_STATUSDELETE" AS SD ON U.DELETESTATUS = SD.DELETESTATUS`;
            query += queryWhere;
            let response1 = await db.run(query);
            db.tx().commit();
            return response1;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('cParameters', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryInsert = `INSERT INTO "` + schemaName + `"."DB_PARAMETERS"(KEY_VIEW, VALUE_VIEW, DESCRIPTION, DELETESTATUS) VALUES($1, $2, $3, $4)`;
            let responseInsert = await db.run(queryInsert, [param.KEY_VIEW, param.VALUE_VIEW, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_add_message,
                data: {}
            };
            if (responseInsert === 1) {
                outMessage.code = 200;
                outMessage.message = add_message + " en la tabla DB_PARAMETERS";
                outMessage.data = await getRegister("DB_PARAMETERS", "KEY_VIEW", param.KEY_VIEW);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    this.on('uParameters', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input;
            let queryUpdate = `UPDATE "` + schemaName + `"."DB_PARAMETERS" SET KEY_VIEW = $1, VALUE_VIEW = $2, DESCRIPTION = $3, DELETESTATUS = $4 WHERE "KEY_VIEW" = $1`;
            let responseUpdate = await db.run(queryUpdate, [param.KEY_VIEW, param.VALUE_VIEW, param.DESCRIPTION, param.DELETESTATUS]);
            db.tx().commit();

            let outMessage = {
                code: 400,
                message: not_update_message,
                data: {}
            };
            if (responseUpdate === 1) {
                outMessage.code = 200;
                outMessage.message = update_message + " en la tabla DB_PARAMETERS";
                outMessage.data = await getRegister("DB_PARAMETERS", "KEY_VIEW", param.KEY_VIEW);
            }
            return outMessage;
        } catch (e) {
            res.status(e.code).json(e);
        }
    });

    // this.on('gPurchaseOrderPdfCollection', async req => {
    //     let { res } = req.http;
    //     let cookieBase = await setCookieBase(req);
    //     try {
    //         let param = req.data.input;
    //         let purchaseOrder = param.Purchaseorder;
    //         let tokenSession = await getTokenSessionForCookies(req);
    //         param.TokenSession = tokenSession;

    //         let validate = await validateSession(param, req);
    //         if (validate === "DURATION") {
    //             ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurchaseOrderPdfCollection, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
    //             res.status(400).json({
    //                 code: 305,
    //                 message: "El tiempo de la sesion ha expirado"
    //             });
    //         }
    //         if (validate === "OK") {
    //             if (purchaseOrder.length > 0) {
    //                 try {
    //                     const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');

    //                     const result = await PORTAL_PROVEEDORES.send({
    //                         method: 'GET',
    //                         path: "/PurchaseOrderPdfCollection('" + purchaseOrder + "')/$value",
    //                         headers: {
    //                             'content-type': 'application/json',
    //                             'Accept': 'application/pdf'
    //                         }
    //                     });

    //                     if (result) {
    //                         // Configurar headers para la respuesta PDF
    //                         res.setHeader('Content-Type', 'application/pdf');
    //                         res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');

    //                         return result;

    //                     } else {
    //                         throw new Error('No se pudo obtener el PDF');
    //                     }
    //                     return result;
    //                 } catch (e) {
    //                     ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurchaseOrderPdfCollection, conexión OData", detail: JSON.stringify(e) });

    //                     // Proporcionar más detalles sobre el error
    //                     if (e.response) {
    //                         return e.response.text(); // Puede ser útil
    //                     } else { return e.message }
    //                 }
    //             } else {
    //                 res.status(400).json({
    //                     code: 302,
    //                     message: "Falta campo clave para completar la solicitud"
    //                 });
    //             }
    //         } else {
    //             ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurchaseOrderPdfCollection, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
    //             res.status(400).json({
    //                 code: 303,
    //                 error: validate,
    //                 message: "No fue posible acceder a la información con los datos informados"
    //             });
    //         }
    //     } catch (e) {
    //         ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gPurchaseOrderPdfCollection", detail: JSON.stringify(e) });
    //         res.status(e.code).json(e);
    //     }
    // });

    this.on('gPurchaseOrderPdfCollection', async req => {
        let { res } = req.http;
        try {
            let param = req.data.input || {};
            let purchaseOrder = param.Purchaseorder;
            if (!purchaseOrder || purchaseOrder.length === 0) {
                return res.status(400).json({
                    code: 302,
                    message: "Falta Purchase Order"
                });
            }

            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            let validate = await validateSession(param, req);
            if (validate !== "OK") {
                return res.status(401).json({
                    code: 303,
                    message: "Sesión inválida"
                });
            }

            let supplier = await getSupplierForSecret(param);
            if (!supplier || supplier === "0000000000") {
                return res.status(403).json({
                    code: 403,
                    message: "Proveedor no autorizado"
                });
            }
            const PORTAL_PROVEEDORES = await cds.connect.to(
                'ZMM_PORTAL_PROVEEDORES_SRV'
            );
            const { purcharseOrderSet } = PORTAL_PROVEEDORES.entities;
            const authorizationResult = await PORTAL_PROVEEDORES.run(
                SELECT
                    .from(purcharseOrderSet)
                    .where({
                        Purchaseorder: purchaseOrder,
                        Supplier: supplier
                    })
            );

            if (!authorizationResult || authorizationResult.length === 0) {
                return res.status(403).json({
                    code: 403,
                    message: "No autorizado para acceder a esta orden"
                });
            }
            const pdfResult = await PORTAL_PROVEEDORES.send({
                method: 'GET',
                path: `/PurchaseOrderPdfCollection('${purchaseOrder}')/$value`,
                headers: {
                    'Accept': 'application/pdf'
                }
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${purchaseOrder}.pdf"`
            );
            return pdfResult;
        } catch (e) {
            return res.status(500).json({
                code: 500,
                message: "Error interno"
            });
        }
    });

    this.on('gDownloadFileSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let purchaseOrder = param.PurchaseOrder;
            let entrySheet = param.EntrySheet;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gDownloadFileSet, duración de sesión", detail: "El tiempo de la sesión ha expirado" });
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {
                if (purchaseOrder.length > 0) {

                    const PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                    const { downloadFileSet } = PORTAL_PROVEEDORES.entities;
                    const result = await PORTAL_PROVEEDORES.run(
                        SELECT.from(downloadFileSet).where({ purchaseOrder: purchaseOrder })
                    );
                    return result;
                } else if (entrySheet.toString().length > 0) {
                    let entry = entrySheet.toString();

                    if (!isNaN(entry)) {
                        let querySelect1 = `SELECT DD.SHEETNUMBER FROM "` + schemaName + `"."DB_DECLAREDELIVERY" AS DD WHERE DD.DECLARATIONIDENTIFIER = ` + Number(entry);
                        let responseSelect1 = await db.run(querySelect1);
                        db.tx().commit();

                        if (responseSelect1.length > 0) {
                            let sheetNumber = responseSelect1[0].SHEETNUMBER;
                            if (sheetNumber.length > 0) {
                                const PORTAL_PROVEEDORES2 = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                                const { downloadFileSet } = PORTAL_PROVEEDORES2.entities;
                                const result2 = await PORTAL_PROVEEDORES2.run(
                                    SELECT.from(downloadFileSet).where({ entrySheet: sheetNumber })
                                );
                                return result2;
                            } else {
                                return [];
                            }
                        } else {
                            return [];
                        }
                    } else {
                        return [];
                    }
                } else {
                    res.status(400).json({
                        code: 302,
                        message: "Falta campo clave para completar la solicitud"
                    });
                }
            } else {
                ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gDownloadFileSet, validaciones de sesión", detail: "No fue posible acceder a la información con los datos informados: " + validate });
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gDownloadFileSet", detail: JSON.stringify(e) });
            res.status(e.code).json(e);
        }
    });

    this.on('gAuthorityCheck', async req => {

        try {
            const { userID, appID, accessID } = req.data.input;
            let deleteStatus = '1';

            const result = await SELECT.from('DB_USERSPROFILES')
                .innerJoin('DB_PROFILES')
                .on('DB_USERSPROFILES.PROFILEID = DB_PROFILES.PROFILEID')
                .where({
                    'DB_USERSPROFILES.USERID': userID,
                    'DB_USERSPROFILES.DELETESTATUS': deleteStatus,
                    'DB_PROFILES.APPID_APPID': appID,
                    'DB_PROFILES.ACCESSID_ACCESSID': accessID,
                    'DB_PROFILES.DELETESTATUS': deleteStatus
                })
                .limit(1);

            return { authorized: result.length > 0 ? 'X' : '' };

        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gAuthorityCheck", detail: JSON.stringify(e) });
            return e.message
        }
    });

    //Retornar perfiles asociados al usuario 
    this.on('gUserProfiles', async req => {
        try {
            const { userID } = req.data.input;


            const userProfiles = await SELECT.from('DB_USERSPROFILES as UP')
                .columns('UP.USERID', 'UP.PROFILEID', 'UP.DELETESTATUS')
                .where({ 'UP.USERID': userID });

            // Array para almacenar resultados finales
            const finalResults = [];

            // Procesar cada perfil y obtener su descripción
            for (const profile of userProfiles) {
                const profileDescription = await SELECT.one.from('DB_PROFILES')
                    .columns('DESCRIPTION')
                    .where({ 'PROFILEID': profile.PROFILEID });

                finalResults.push({
                    USERID: profile.USERID,
                    PROFILEID: profile.PROFILEID,
                    DELETESTATUS: profile.DELETESTATUS,
                    DESCRIPTION: profileDescription ? profileDescription.DESCRIPTION : null
                });
            }

            if (finalResults.length === 0) {
                return userProfiles;

            } else { return finalResults; }

        } catch (error) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gUserProfiles", detail: JSON.stringify(error) });
            // Manejo de errores
            console.error('Error retrieving user profiles:', error);
            return error.message;
        }

    });

    this.on('gIsVendorActive', async req => {
        const { VENDOR } = req.data.input;
        let deleteStatus = '1';
        try {
            const result = await SELECT.one.from('DB_USERSVENDORS')
                .columns('VENDORID')
                .where({
                    VENDORID: VENDOR,
                    DELETESTATUS: deleteStatus
                })
                .limit(1);

            let active = '1';
            if (result) {
                active = '1'; // Proveedor activo
            } else {
                active = '0'; // Proveedor no activo
            }
            return active;
        } catch (e) {
            ////let logSystem = await setLogSystem({ location: "Portal", action: "Error", description: "Error en el método gIsVendorActive", detail: JSON.stringify(e) });
            return e.message
        }
    });

    this.on('gDataVendorActive', async req => {
        const { VENDOR } = req.data.input;
        let deleteStatus = '1';

        try {
            let retorno = [];

            let query = `SELECT * FROM "` + schemaName + `"."DB_USERSVENDORS" AS UV 
                WHERE UV.VENDORID = '${VENDOR}' AND UV.DELETESTATUS = '${deleteStatus}'
                `;

            let result = await db.run(query);
            db.tx().commit();

            let functionRecorrer = async function (items, i) {
                if (items.length === i) {
                    return retorno;
                } else {
                    let item = items[i];

                    const data_user = await SELECT.one.from('DB_USERSMASTER')
                        .where({
                            USERID: item.USERID_USERID
                        });

                    let oe = data_user.EMAIL;

                    if (item.OFFICIALEMAIL !== null && item.OFFICIALEMAIL !== undefined) {
                        if (item.OFFICIALEMAIL.length > 0) {
                            oe = item.OFFICIALEMAIL;
                        }
                    }
                    retorno.push({
                        ACTIVE: item.DELETESTATUS,
                        OFFICIAL_EMAIL: oe
                    });

                    i++;
                    return await functionRecorrer(items, i);
                }
            };
            await functionRecorrer(result, 0);
            let retornoFinal = await eliminaDuplicado(retorno, "OFFICIAL_EMAIL");
            return retornoFinal;
        } catch (e) {
            return e.message
        }
    });

    this.on('gCheckHesSet', async req => {
        let { res } = req.http;
        let cookieBase = await setCookieBase(req);
        try {
            let param = req.data.input;
            let tokenSession = await getTokenSessionForCookies(req);
            param.TokenSession = tokenSession;
            param.Supplier = await getSupplierForSecret(param);
            let supplier = param.Supplier;

            let validate = await validateSession(param, req);
            if (validate === "DURATION") {
                res.status(400).json({
                    code: 305,
                    message: "El tiempo de la sesion ha expirado"
                });
            }
            if (validate === "OK") {

                if (!param.DECLARATIONIDENTIFIER) {
                    return res.status(400).json({
                        message: "DECLARATIONIDENTIFIER es obligatorio para continuar."
                    });
                }

                let nro_externo = param.DECLARATIONIDENTIFIER;
                let queryDynamic = `Nro_Externo='` + nro_externo + `'`;

                let PORTAL_PROVEEDORES = await cds.connect.to('ZMM_PORTAL_PROVEEDORES_SRV');
                let { checkHesSet } = PORTAL_PROVEEDORES.entities;
                let arrayResult = await PORTAL_PROVEEDORES.run(SELECT.from(checkHesSet).where(queryDynamic));
                return arrayResult;

            } else {
                res.status(400).json({
                    code: 303,
                    error: validate,
                    message: "No fue posible acceder a la información con los datos informados"
                });
            }
        } catch (e) {
            console.error("Error en gCheckHesSet:", e);

            return res.status(500).json({
                code: 500,
                message: e.message || "Internal Server Error",
                error: e
            });
        }
    });


});