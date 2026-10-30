using {db} from '../db/portalProveedores';

@path: '/UserService'
service UserService {
  @odata.draft.enabled // Agregar esta anotación
  entity UsersMaster           as select * from db.UsersMaster;
  entity UsersProfiles         as select * from db.UsersProfiles;
  @odata.draft.enabled // Agregar esta anotación
  entity Profiles              as select * from db.Profiles;
  entity UsersVendors          as select * from db.UsersVendors;
  @odata.draft.enabled // Agregar esta anotación
  entity AccessText            as select * from db.AccessText;
  @odata.draft.enabled // Agregar esta anotación
  entity UsersStatus           as select * from db.UsersStatus;
  @odata.draft.enabled // Agregar esta anotación
  entity UsersType             as select * from db.UsersType;
  @odata.draft.enabled // Agregar esta anotación
  entity AppsMaster            as select * from db.AppsMaster;
  entity AppsAccess            as select * from db.AppsAccess;
  entity notifications         as select * from db.notifications;
  entity notificationsControl  as select * from db.notificationsControl;
  entity TermsAndConditionsLog as select * from db.TermsAndConditionsLog;
}

@path: '/OdataServicePPC'
service OdataServicePPC {
  entity UsersMaster                  as select * from db.UsersMaster;
  entity UsersProfiles                as select * from db.UsersProfiles;
  entity Profiles                     as select * from db.Profiles;
  entity UsersVendors                 as select * from db.UsersVendors;
  entity AccessText                   as select * from db.AccessText;
  entity UsersStatus                  as select * from db.UsersStatus;
  entity UsersType                    as select * from db.UsersType;
  entity AppsMaster                   as select * from db.AppsMaster;
  entity AppsAccess                   as select * from db.AppsAccess;
  entity notifications                as select * from db.notifications;
  entity notificationsControl         as select * from db.notificationsControl;
  entity TermsAndConditionsLog        as select * from db.TermsAndConditionsLog;
  entity DeclareDelivery              as select * from db.DeclareDelivery;
  entity DocumentsDeliveryDeclaration as select * from db.DocumentsDeliveryDeclaration;
  entity Faq                          as select * from db.FAQ;
  entity ItemsDeliveryDeclaration     as select * from db.ItemsDeliveryDeclaration;
  entity MovementsDates               as select * from db.MovementsDates;
  entity NotificationLog              as select * from db.notificationLog;
  entity SystemLog                    as select * from db.SystemLog;
}

@path: '/DocumentsDates'
service DocumentsDates {
  entity MovementsDates as select * from db.MovementsDates;
}

using {portalservices as external} from './external/portalservices.csn';

@protocol: 'rest'
@path    : '/Odata'
service Rest {
  @readonly
  entity vendorSet as projection on external.vendorSet;
}

@protocol: 'rest'
@path    : '/PORTAL_PROVEEDORES_REST'
service PORTAL_PROVEEDORES_REST {
  @open
  type object {};

  function gSySet()                                               returns object; //Odata SAP ECC
  action   gSessionUser(input: object)                            returns object; //Odata SAP ECC
  action   gVendorKeySet(input: object)                           returns object; //Odata SAP ECC
  action   gInfoUser(input: object)                               returns object; //Hana BTP
  action   gUserInfoPortal(input: object)                         returns object; //Hana BTP
  action   gTokenAuth0(input: object)                             returns object; //Hana BTP
  action   gInfoUserAuth0(input: object)                          returns object; //Hana BTP
  action   uInfoUser(input: object)                               returns object; //Hana BTP
  action   uOfficialEmail(input: object)                          returns object; //Hana BTP

  action   uSecretSession(input: object)                          returns array of object; //Hana BTP
  action   uLogout(input: object)                                 returns array of object; //Hana BTP
  action   gValidateSecretSession(input: object)                  returns array of object; //Hana BTP
  action   gCompanySet(input: object)                             returns array of object; //Odata SAP ECC
  action   gPurchaseOrderStatusSet(input: object)                 returns array of object; //Odata SAP ECC
  action   gPurcharseOrderSet(input: object)                      returns array of object; //Odata SAP ECC
  action   gSubposSet(input: object)                              returns array of object; //Odata SAP ECC
  action   gPurcharseOrderItemsSet(input: object)                 returns array of object; //Odata SAP ECC
  action   gVendorsPortal(input: object)                          returns array of object; //Odata SAP ECC
  action   gVendorsActivePortal(input: object)                    returns array of object; //Odata SAP ECC
  action   gVendorSet(input: object)                              returns array of object; //Odata SAP ECC
  action   gVendorSetPortal(input: object)                        returns array of object; //Odata SAP ECC
  action   gVendorSetSearchPortal(input: object)                  returns array of object; //Odata SAP ECC
  action   gPaymentsHeaderSet(input: object)                      returns array of object; //Odata SAP ECC
  action   gGenericListInfoSet(input: object)                     returns array of object; //Odata SAP ECC
  action   gPurchaseOrderPdfCollection(input: object)             returns array of object; //Odata SAP ECC
  action   gDownloadFileSet(input: object)                        returns array of object; //Odata SAP ECC

  action   gSolicitanteSet(input: object)                         returns array of object; //Odata SAP ECC

  action   uResendEmailVerification(input: object)                returns array of object; //Hana BTP
  action   uVendorSet(input: object)                              returns array of object; //Odata SAP ECC
  action   uVendorSetFirstAccess(input: object)                   returns array of object; //Odata SAP ECC
  action   gMovementsDates(input: object)                         returns array of object; //Hana BTP
  action   uMovementsDates(input: object)                         returns array of object; //Hana BTP
  action   gTermsAndConditionsLog(input: object)                  returns object; //Hana BTP
  action   uTermsAndConditionsLog(input: object)                  returns object; //Hana BTP

  action   gReportSystemLog(input: object)                        returns array of object; //Hana BTP
  action   gReportLogAuth0(input: object)                         returns array of object; //Hana BTP

  action   gVendorWithLeastOneAccess(input: object)               returns array of object; //Hana BTP
  action   gVendorWithLeastOneAccessInTheLastMonth(input: object) returns array of object; //Hana BTP

  action   gAppmaster(input: object)                              returns array of object; //Hana BTP
  action   cAppmaster(input: object)                              returns array of object; //Hana BTP
  action   uAppmaster(input: object)                              returns array of object; //Hana BTP
  action   gAccesstext(input: object)                             returns array of object; //Hana BTP
  action   cAccesstext(input: object)                             returns array of object; //Hana BTP
  action   uAccesstext(input: object)                             returns array of object; //Hana BTP
  action   gUserstype(input: object)                              returns array of object; //Hana BTP
  action   cUserstype(input: object)                              returns array of object; //Hana BTP
  action   uUserstype(input: object)                              returns array of object; //Hana BTP
  action   gUsersprofiles(input: object)                          returns array of object; //Hana BTP
  action   cUsersprofiles(input: object)                          returns array of object; //Hana BTP
  action   uUsersprofiles(input: object)                          returns array of object; //Hana BTP
  action   gUsersstatus(input: object)                            returns array of object; //Hana BTP
  action   cUsersstatus(input: object)                            returns array of object; //Hana BTP
  action   uUsersstatus(input: object)                            returns array of object; //Hana BTP
  action   gUsersvendors(input: object)                           returns array of object; //Hana BTP
  action   cUsersvendors(input: object)                           returns array of object; //Hana BTP
  action   cUserProfiles(input: object)                           returns array of object; //Hana BTP
  action   uUsersvendors(input: object)                           returns array of object; //Hana BTP
  action   dUsersvendors(input: object)                           returns array of object; //Hana BTP
  action   dUserProfiles(input: object)                           returns array of object; //Hana BTP
  action   uStateUsersvendors(input: object)                      returns array of object; //Hana BTP
  action   uStateUserProfiles(input: object)                      returns array of object; //Hana BTP
  action   gUsersMaster(input: object)                            returns array of object; //Hana BTP
  action   cUsersMaster(input: object)                            returns array of object; //Hana BTP
  action   gValidatePassUsers(input: object)                      returns array of object; //Hana BTP
  action   uUsersMaster(input: object)                            returns array of object; //Hana BTP
  action   gProfilesLaunchpad(input: object)                      returns array of object; //Hana BTP
  action   gProfilesUserLaunchpad(input: object)                  returns array of object; //Hana BTP
  action   gProfilesPortal(input: object)                         returns array of object; //Hana BTP
  action   gProfiles(input: object)                               returns array of object; //Hana BTP
  action   cProfiles(input: object)                               returns array of object; //Hana BTP
  action   uProfiles(input: object)                               returns array of object; //Hana BTP
  action   dProfiles(input: object)                               returns array of object; //Hana BTP
  action   gNotificationsControl(input: object)                   returns array of object; //Hana BTP
  action   cNotificationsControl(input: object)                   returns array of object; //Hana BTP
  action   uNotificationsControl(input: object)                   returns array of object; //Hana BTP
  action   gUserNotifications(input: object)                      returns array of object; //Hana BTP
  action   uUserNotifications(input: object)                      returns array of object; //Hana BTP
  action   gNotifications(input: object)                          returns array of object; //Hana BTP
  action   cNotifications(input: object)                          returns array of object; //Hana BTP
  action   uNotifications(input: object)                          returns array of object; //Hana BTP

  action   pNotificacionSet(input: object)                        returns array of object; //Hana BTP

  action   gMaterialDocumentsSet(input: object)                   returns array of object;
  action   gMaterialDocumentsItemsSet(input: object)              returns array of object;
  action   gFAQ(input: object)                                    returns array of object; //Hana BTP
  action   gFAQLaunchpad(input: object)                           returns array of object; //Hana BTP
  action   cFAQ(input: object)                                    returns array of object; //Hana BTP
  action   uFAQ(input: object)                                    returns array of object; //Hana BTP

  action   gITOS(input: object)                                   returns array of object; //Hana BTP

  action   gParametersPortal(input: object)                       returns array of object; //Hana BTP

  action   gParameters(input: object)                             returns array of object; //Hana BTP
  action   cParameters(input: object)                             returns array of object; //Hana BTP
  action   uParameters(input: object)                             returns array of object; //Hana BTP

  action   cDeclareDelivery(input: object)                        returns array of object; //Hana BTP
  action   gDeclareDelivery(input: object)                        returns array of object; //Hana BTP

  action   cAttachmentsDeclareDelivery(input: object)             returns array of object; //Hana BTP
  action   cAttachmentsPurchaseOrder(input: object)               returns array of object; //Hana BTP

  // Servicio que retorna si un usuario esta habilitado para cierta funcionalidad
  action   gAuthorityCheck(input: object)                         returns object; //Hana BTP
  action   gUserProfiles(input: object)                           returns array of object; //Hana BTP
  action   uUserProfiles(input: object)                           returns array of object; //Hana BTP
  action   gIsVendorActive(input: object)                         returns object; //Hana BTP
  action   gDataVendorActive(input: object)                       returns array of object; //Hana BTP
  action   gCheckHesSet(input: object)                            returns array of object; //Odata SAP ECC
}
//using { portalservices as external }  from './external/portalservices.csn';
//@protocol:'rest'

//@path: '/Odata'
//service Odata {
//  @readonly
//  entity vendorSet as projection on external.vendorSet;
//}

/* @cds.sqlViewName: 'PROJ_USERS'
view proj_users as
  select
    um.userID,
    um.email,
    p.appID,
    p.accessID,
    um.userStatusID,
    um.userTypeID,
    uv.vendorID
  from
    db.UsersMaster as um
    left join db.UsersProfiles as up on um.userID = up.userID
    left join db.Profiles as p on up.profileID = p.profileID
    left join db.UsersVendors as uv on um.userID = uv.userID; */

/*
@path: '/zportal_proveedores'
service UserService {

   entity Usuario_Conectado as select * from db.USUARIO_CONECTADO;
   entity Transaccion       as select * from db.TRANSACCION;
   entity Formulario        as select * from db.FORMULARIO;
}

@protocol: 'rest'
@path    : '/zportal_proveedores_rest'
service zportal_proveedores_rest {
   @open
   type object {};

   //action resetTable(input : object) returns object;
   //action updateFieldAll(input : object) returns object;
} */
