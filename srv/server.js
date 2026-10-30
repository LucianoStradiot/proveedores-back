const { rateLimit } = require("express-rate-limit");
const proxy = require("@sap/cds-odata-v2-adapter-proxy");
const cookieParser = require('cookie-parser');
const cds = require('@sap/cds'); 

cds.on("bootstrap", app => {

    app.set("trust proxy", 1);

    app.use(proxy());
    app.use(cookieParser());

    const globalLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false
    });

    app.use("/PORTAL_PROVEEDORES_REST", globalLimiter);

    const strictLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false
    });

    app.use("/PORTAL_PROVEEDORES_REST/gSessionUser", strictLimiter);
    app.use("/PORTAL_PROVEEDORES_REST/gTokenAuth0", strictLimiter);
    app.use("/PORTAL_PROVEEDORES_REST/gValidateSecretSession", strictLimiter);
    app.use("/PORTAL_PROVEEDORES_REST/gValidatePassUsers", strictLimiter);

    const mediumLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false
    });

    app.use("/PORTAL_PROVEEDORES_REST/gPurcharseOrderSet", mediumLimiter);
    app.use("/PORTAL_PROVEEDORES_REST/gPaymentsHeaderSet", mediumLimiter);
    app.use("/PORTAL_PROVEEDORES_REST/gVendorSetSearchPortal", mediumLimiter);

});