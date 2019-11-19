/*!
 * tcmb-doviz-kuru <https://github.com/gdoslu/tcmb-doviz-kuru.git>
 *
 * Copyright (c) 2016, Gokhan Doslu.
 * Licensed under the MIT License.
 */

"use strict";

var tcbmDovizKuru = require("./");

const runTests = async () => {
  try {
    const test1 = await tcbmDovizKuru.today();
    console.log("Test today(): ");
    console.log("");
    console.log(JSON.stringify(test1));
    console.log("--------------------");
    const test2 = await tcbmDovizKuru.today("USD");
    console.log("Test today('USD'): ");
    console.log("");
    console.log(JSON.stringify(test2));
    console.log("--------------------");
    const test4 = await tcbmDovizKuru.date(null);
    console.log("Test date(null): ");
    console.log("");
    console.log(JSON.stringify(test4));
    console.log("--------------------");
    const test5 = await tcbmDovizKuru.date("18/11/2019");
    console.log("Test date('18/11/2019'): ");
    console.log("");
    console.log(JSON.stringify(test5));
    console.log("--------------------");
    const test6 = await tcbmDovizKuru.date("18/11/2019", "GBP");
    console.log("Test date('18/11/2019', 'USD'): ");
    console.log("");
    console.log(JSON.stringify(test6));
    console.log("--------------------");
  } catch (error) {
    console.log(error);
  }
};

runTests();

// FIXME
// describe('tcbmDovizKuru', function () {
//     it('should no errors:', function () {
//
//         assert.deepEqual(errors, []);
//     });
// });
