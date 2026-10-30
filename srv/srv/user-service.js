const cds = require('@sap/cds');

/*
module.exports = cds.service.impl(async function () {

  this.on('READ', 'UsersMaster', async (req) => {
    const email = req.query.SELECT.where[0].val;
    const db = await cds.connect.to('db');
    const results = await db.run(
      SELECT.from('proj_users').where({ email: email })
    );
    return results;
  });

}); */