# aid-sync

與台北市社會局合作的試驗專案，每天從 [衛生福利部重大災害民生物資與志工人力整合網絡平台](http://rvis-manage.mohw.gov.tw/) 下載一份資料到 github。

由於衛福部的重大災害物資平台僅能使用 IE 登入，而目前 Open Data 的方法是由台北市社會局每季從衛福部的網站**手動**下載一次資料並且放到 [台北市開放資料平台](http://data.taipei/opendata/datalist/datasetMeta?oid=99303c65-81f3-49b6-a5c6-c876743c7508)。為了提升效率，所以撰寫了這個小程式用 curl 指令改變 user-agent 模擬 IE 登入衛福部網站、下載資料並且從 HTML 轉換成 CSV 標準格式。

每日更新的 CSV 位置： [https://github.com/g0v/aid-sync/blob/gh-pages/aid.csv](https://github.com/g0v/aid-sync/blob/gh-pages/aid.csv)

## 每日自動備份

每日的自動備份目前是用 Iron Worker 約晚間十點時自動執行並且更新到 github，目前使用 [Yuren Ju](https://github.com/yurenju) 的 iron.io 帳號，若需要做什麼變更請跟他聯繫。

## 授權

MIT 授權
