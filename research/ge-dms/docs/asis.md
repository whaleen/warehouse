AUTH
https://dms-erp-aws-prd.geappliances.com/dms/

https://sso.geappliances.com/login?state=hKFo2SBLYWRGNWtkUkZsMW5DV2stWDJSYTlaNU5VeDlHY1hlbaFupWxvZ2luo3RpZNkgTlRQTmYwaEJsZlRlLXd0d1M5MThMcjRJdXM4Ul9JbUWjY2lk2SAzdmVmTkpWdnh3SFpRMGVGRnZEam96T1A3a2xTalFteA&client=3vefNJVvxwHZQ0eFFvDjozOP7klSjQmx&protocol=oauth2&response_type=code&scope=openid%20email%20profile&redirect_uri=https%3A%2F%2Fdms-erp-aws-prd.geappliances.com%2Foauth2%2Fidpresponse&nonce=E8ani6j4_i7ADeskpauXJmnvgkiAoJhzRiHKp4TWp3M

i login with my sss_username and sso_password and am brought to this url again: https://dms-erp-aws-prd.geappliances.com/dms/

i check for cookies. here they are:

__cf_bm	oItvLRlDwwIdzzAOF8tLLuvBlX7tfF.JHaU_9r8cavc-1768677828-1.0.1.1-VSB3WTsHnX4cSfKAfXokVY97LIBizM6DfOY1I.8G75pjMTETUSmR9b4pufFgWCjWPKlt2DmWay7qwHX51bGLdvEcAlHRQTX19etQI6S7KF4	.geappliances.com	/	1/17/2026, 11:53:48 AM	177 B	✓	✓	
AWSALB	HftHgHMR3l78sgqiWOnDNqxGepK7v0yDbe3zK8BDp/AH8Q9wl+wkmbec6dpVW9e+3xpPhmDsejQGZdhv1+0QoBk968iRtmN+SVzG3yQrvCiNi/9Z4Tcu7jhBglXP	dms-erp-aws-prd.geappliances.com	/	1/24/2026, 11:23:42 AM	130 B			
AWSALBCORS	HftHgHMR3l78sgqiWOnDNqxGepK7v0yDbe3zK8BDp/AH8Q9wl+wkmbec6dpVW9e+3xpPhmDsejQGZdhv1+0QoBk968iRtmN+SVzG3yQrvCiNi/9Z4Tcu7jhBglXP	dms-erp-aws-prd.geappliances.com	/	1/24/2026, 11:23:42 AM	134 B	✓		
JSESSIONID	096382A01F02DF7F6387CFA407FE36B3	dms-erp-aws-prd.geappliances.com	/dms	Session	42 B		✓	
mod_auth_openidc_session	Zcl_C6lACrTHOclw1IB-ecB4uOg	dms-erp-aws-prd.geappliances.com	/	Session	51 B	✓	✓	


now i navigate to: 

https://dms-erp-aws-prd.geappliances.com/dms/newasis

i click on the ASIS Load Spreadsheet "button":

<input id="dms_button" class="submitButton" type="button" align="right" value="ASIS Load SpreadSheet" onclick="if (!window.__cfRLUnblockHandlers) return false; exportSpreadSheet();">

and it downloads ASISLoadData.xls to my computer.


i can show you the html from which i click that spreadsheet button next.
---



when running:

cucurl -sSL \
  -b cookies.txt \
  -H 'Referer: https://dms-erp-aws-prd.geappliances.com/dms/newasis' \
  -H 'User-Agent: Mozilla/5.0' \
  --data 'request=ASIS&dmsLoc=9SU' \
  'https://dms-erp-aws-prd.geappliances.com/dms/newasis/downloadExcelSpreadsheet' \
  -o public/ASIS/ASISLoadData.xls

this works. 

not sure the load we are trying won't.

ASIS
https://dms-erp-aws-prd.geappliances.com/dms/newasis




ASIS 
https://dms-erp-aws-prd.geappliances.com/dms/newasis/getreporthistory