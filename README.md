## tcmb-doviz-kuru

Get Indicative Exchange Rates Announced by the Central Bank of Turkey

## Install with npm

https://www.npmjs.com/package/tcmb-doviz-kuru

```bash
npm i tcmb-doviz-kuru --save
```

## Usage

```js
var tcmbDovizKuru = require("tcmb-doviz-kuru");

try {
  const currentRates = await tcmbDovizKuru.today(); // All of today's exchange rates
  const currentUSD = await tcmbDovizKuru.today("USD"); // Today's USD exchange rates
  const specificRates = await tcmbDovizKuru.date("01/01/2019"); // Specific date's exchange rates
  const specificUSD = await tcmbDovizKuru.date("01/01/2019", "USD"); // Specific date's USD rates
} catch (error) {
  // handle error
}
```

## Example Response of All Exchange Rates

```json
{
  "tarihDate": {
    "attributes": {
      "tarih": "19.11.2019",
      "date": "11/19/2019",
      "bultenNo": "2019/217"
    },
    "currency": [
      {
        "attributes": {
          "crossOrder": "0",
          "kod": "USD",
          "currencyCode": "USD"
        },
        "unit": 1,
        "isim": "ABD DOLARI",
        "currencyName": "US DOLLAR",
        "forexBuying": 5.7153,
        "forexSelling": 5.7256,
        "banknoteBuying": 5.7113,
        "banknoteSelling": 5.7342,
        "crossRateUSD": null,
        "crossRateOther": null
      },
      {
        "attributes": {
          "crossOrder": "1",
          "kod": "AUD",
          "currencyCode": "AUD"
        },
        "unit": 1,
        "isim": "AVUSTRALYA DOLARI",
        "currencyName": "AUSTRALIAN DOLLAR",
        "forexBuying": 3.8825,
        "forexSelling": 3.9078,
        "banknoteBuying": 3.8646,
        "banknoteSelling": 3.9312,
        "crossRateUSD": 1.4686,
        "crossRateOther": null
      },
      .
      .
      .
    ]
  }
}
```

## Example Response of Specific Exchange Rate

```json
{
  "tarihDate": {
    "attributes": {
      "tarih": "19.11.2019",
      "date": "11/19/2019",
      "bultenNo": "2019/217"
    },
    "currency": {
      "attributes": {
        "crossOrder": "0",
        "kod": "USD",
        "currencyCode": "USD"
      },
      "unit": 1,
      "isim": "ABD DOLARI",
      "currencyName": "US DOLLAR",
      "forexBuying": 5.7153,
      "forexSelling": 5.7256,
      "banknoteBuying": 5.7113,
      "banknoteSelling": 5.7342,
      "crossRateUSD": null,
      "crossRateOther": null
    }
  }
}
```

## License

Copyright (c) 2016 Gokhan Doslu
Released under the MIT license
