namespace db;

using {cuid} from '@sap/cds/common';

entity SessionUser {
  key accessToken : String(255);
      Supplier    : String(20);
      Mail        : String(255);
      Nonce       : String(999);
      TimeCreate  : String(999);
      Status      : String(1);

}

// Access Text Entity
//  01	Crear
//  02	Modificar
//  03	Borrar
//  04	Ver
entity AccessText {
  key accessID     : String(2);
      description  : String(20);
      deleteStatus : String(1);
}

// Users Status Entity
//01 - Nuevo
// 02- habilitado
//10 -sin primer acceso
// 90 -  bloqueado
entity UsersStatus {
  key userStatusID : String(3);
      description  : String(30);
      deleteStatus : String(1);
}

// Users Type Entity
// 01 - Representante
// 02 - Asistente
entity UsersType {
  key userTypeID   : String(2);
      description  : String(30);
      deleteStatus : String(1);
}

// Apps Master Entity
entity AppsMaster {
  key appID        : String(10);
      description  : String(30);
      url          : String(999);
      deleteStatus : String(1);
}

entity StatusDelete {
  key deleteStatus : String(1);
      description  : String(30);
}

// Apps Master Entity
entity AppsAccess {
  key appID    : String(10);
  key accessID : Association to AccessText;
}

/*
// Profiles Entity
entity Profiles {
  key profileID    : String(15);
  key appID        : Association to AppsMaster;
  key accessID     : Association to AccessText;
      description  : String(30);
      deleteStatus : String(1);
}
*/

// Profiles Entity
entity Profiles {
  key profileID    : String(15);
  key appID        : Association to AppsMaster;
  key accessID     : Association to AccessText;
      description  : String(255);
      deleteStatus : String(1);
}

// Users Master Entity
entity UsersMaster {
  key userID               : Integer;
      auth0ID              : String(100);
      email                : String(240);
      firstChangePass      : Integer;
      dateFirstChangePass  : DateTime;
      user_erp             : String(10);
      purchasing_group_erp : String(3);
      userTypeID           : Association to UsersType;
      userStatusID         : Association to UsersStatus;
      secret               : LargeString;
}


// Users Profiles Entity
entity UsersProfiles {
  key userID       : Integer; //Association to UsersMaster;
  key profileID    : String(15); //Association to Profiles;
      UsersMaster  : Association to UsersMaster
                       on UsersMaster.userID = userID;
      Profiles     : Association to Profiles
                       on Profiles.profileID = profileID;
      deleteStatus : String(1);
}


/*
// Users Profiles Entity
entity UserProfiles {
  key userID       : Association to UsersMaster;
  key profileID    : Association to Profiles;
      deleteStatus : String(1);
}
*/

// Users Vendors Entity
entity UsersVendors {
  key userID          : Association to UsersMaster;
  key vendorID        : String(20);
      firstAccess     : Integer;
      dateFirstAccess : DateTime;
      officialEmail   : String(240);
      deleteStatus    : String(1);
}


// Users deletegate
entity UsersDelegated {
  key userID        : Association to UsersMaster;
  key userMaesterID : Integer;
      email         : String(240);
}

// Log material document dates
entity MovementsDates {
  key PurchaseOrder        : Integer;
  key PurchaseOrderItem    : Integer;
  key Package              : Integer;
      LineNumber           : Integer;
      Service              : String(18);
      MaterialDocument     : Integer;
      MaterialDocumentItem : Integer;
      VendorID             : String(20);
      PlannedDate          : Date;
      UserID               : String(10);
      LogDate              : Date;
      LogTime              : Time;
      Status               : String(1);
}

// Log of acceptance of terms and conditions
entity TermsAndConditionsLog {
  key userID         : Association to UsersMaster;
  key acceptanceDate : DateTime;
}

entity DeclareDelivery {
  key declarationIdentifier         : Integer;
      purchaseOrder                 : String(10);
      purchaseorderitem             : String(5);
      purchaseorderitemcategory     : String(1);
      purchaseorderitemcategoryText : String(10);
      servicepackage                : String(15);
      dateServicepackage            : DateTime;
      deliveryAddress               : String(100);
      companycode                   : String(4);
      companycodeDescription        : String(50);
      declaredAmount                : Decimal;
      declarationDate               : DateTime;
      descriptionDeclaration        : String(500);
      supplierName                  : String(100);
      supplier                      : String(10);
      plannedDate                   : DateTime;
      createdbyuser                 : Integer;
      createdDate                   : DateTime;
      declarationStatus             : String(1);
      sheetNumber                   : String(20);
      messageService                : String(500);
      realQuantity                  : Decimal;
      purchaseorderitemText         : String(50);
      ito_user_erp                  : String(10);
}

entity ItemsDeliveryDeclaration {
  key itemsDeliveryDeclarationIdentifier : Integer;
      declarationIdentifier              : Integer;
      purchaseorderitem                  : String(5);
      material                           : String(20);
      purchaseorderitemtext              : String(45);
      purchaseorderquantityunit          : String(5);
      documentCurrency                   : String(5);
      orderquantitytext                  : String(20);
      invoiceavailablequantity           : Decimal;
      invoicedeclarequantity             : Decimal;
      invoicequantity                    : Decimal;
      netpriceamount                     : Decimal;
      totpricedeclare                    : Decimal;
      percentagedeclare                  : String(5);
}


entity FAQ {
  key id           : Integer;
      question     : String(999);
      answer       : String(999);
      type         : String(100);
      deleteStatus : String(1);
}

entity DocumentsDeliveryDeclaration {
  key documentsIdentifier   : Integer;
      declarationIdentifier : Integer;
      name                  : String(500);
      size                  : Integer;
      dateUpload            : DateTime;
      type                  : String(100);
      deleteStatus          : String(1);
}

entity notifications {
  key id               : Integer;
  key vendorID         : String(20);
      document         : String(10);
      scenario         : String(2);
      movement         : String(20);
      notificationDate : DateTime;
      message          : String(999);
      viewedFlag       : String(1);
}

entity notificationLog {
  key id                  : Integer;
      idNotifications     : Integer;
      userID              : Integer;
      notificationLogDate : DateTime;
}

entity notificationsControl {
  key id             : Integer;
      functionality  : String(100);
      sendMailFlag   : String(1);
      sendPortalFlag : String(1);
      sendOrigin     : String(10);
      deleteStatus   : String(1);
}

entity Parameters {
  key key_view     : String(100);
      value_view   : String(999);
      description  : String(100);
      deleteStatus : String(1);
}

entity SystemLog : cuid {
  creation_date   : DateTime;
  action          : String(100);
  location        : String(50);
  description     : String(999);
  creation_user   : String(255);
  app_description : String(999);
  detail          : LargeString;
  deleteStatus    : String(1);
}
