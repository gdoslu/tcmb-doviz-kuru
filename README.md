## tcmb-doviz-kuru

Get Indicative Exchange Rates Announced by the Central Bank of Turkey



## Install with npm

https://www.npmjs.com/package/tcmb-doviz-kuru

```bash
npm i tcmb-doviz-kuru --save
```


## Usage

```js
var tcmbDovizKuru = require('tcmb-doviz-kuru');

function cb(error, data) {
    if (error) {
        console.log('error', error)
    }
    console.log(JSON.stringify(data));
}

tcmbDovizKuru(cb);
```

## License
Copyright (c) 2016 Gokhan Doslu 
Released under the MIT license
