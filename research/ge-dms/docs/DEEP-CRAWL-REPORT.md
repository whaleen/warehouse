# GE DMS Deep Crawl Report

**Organization:** 9SU
**Date:** 2026-01-22T04:26:37.130Z

## Summary

- Pages Explored: 41
- Export Endpoints Found: 5

---

## All Visited Pages

1. https://dms-erp-aws-prd.geappliances.com/dms/
2. https://dms-erp-aws-prd.geappliances.com/dms/messages/messagetitledetail?&type=GE_DELIVERS
3. https://dms-erp-aws-prd.geappliances.com/dms/faqadmin/faqsearch
4. https://prd.digideck.appliancedms.com/communicationportal/comm?sso=515511228&invOrg=9SU
5. https://dms-erp-aws-prd.geappliances.com/dms/downloads
6. https://dms-erp-aws-prd.geappliances.com/dms/manifest/viewManifest
7. https://dms-erp-aws-prd.geappliances.com/dms/meettruck/meetTruckHelp
8. https://dms-erp-aws-prd.geappliances.com/dms/orderdata
9. https://dms-erp-aws-prd.geappliances.com/dms/parkinglot
10. https://dms-erp-aws-prd.geappliances.com/dms/truckstatus/warehouse_exception_report
11. https://dms-erp-aws-prd.geappliances.com/dms/agentcommunication/search
12. https://dms-erp-aws-prd.geappliances.com/dms/damage/viewDamageSummary
13. https://dms-erp-aws-prd.geappliances.com/dms/haulawaysummary
14. https://dms-erp-aws-prd.geappliances.com/dms/payment/getsdslocations
15. https://dms-erp-aws-prd.geappliances.com/dms/recycle
16. https://dms-erp-aws-prd.geappliances.com/dms/antitippaudit/antitip_audit_report
17. https://dms-erp-aws-prd.geappliances.com/dms/locmaintenance/editLocMaintenance
18. https://dms-erp-aws-prd.geappliances.com/dms/pod/search
19. https://dms-erp-aws-prd.geappliances.com/dms/openorderreport
20. https://dms-erp-aws-prd.geappliances.com/dms/reportsummary
21. https://dms-erp-aws-prd.geappliances.com/dms/tracktrace
22. https://dms-erp-aws-prd.geappliances.com/dms/truckstatus
23. https://prd.digideck.appliancedms.com/scanbyeachstaging/scan?invOrg=9SU
24. https://dms-erp-aws-prd.geappliances.com/dms/checkinaudit/checkin_audit_report
25. https://dms-erp-aws-prd.geappliances.com/dms/newasis
26. https://dms-erp-aws-prd.geappliances.com/dms/backhaul
27. https://dms-erp-aws-prd.geappliances.com/dms/cyclecount/invorgs
28. https://dms-erp-aws-prd.geappliances.com/dms/erpCheckInventory
29. https://dms-erp-aws-prd.geappliances.com/dms/inventoryadjforms
30. https://prd.digideck.appliancedms.com/inventory/report?invOrg=9SU
31. https://dms-erp-aws-prd.geappliances.com/dms/backhaulnew/non-gebackhaul
32. https://dms-erp-aws-prd.geappliances.com/dms/inventory/sflsPendingOrders
33. https://dms-erp-aws-prd.geappliances.com/dms/scrap?init=1
34. https://dms-erp-aws-prd.geappliances.com/dms/tracktrace/searchbyserial
35. https://dms-erp-aws-prd.geappliances.com/dms/newdmsapplication/home
36. https://dms-erp-aws-prd.geappliances.com/dms/driverAppPhotos
37. https://dms-erp-aws-prd.geappliances.com/dms/resources/download/GEAD_eTicket_AgentTraining.v2.pdf
38. https://dms-erp-aws-prd.geappliances.com/dms/epod
39. https://dms-erp-aws-prd.geappliances.com/dms/_home
40. https://dms-erp-aws-prd.geappliances.com/dms/users/userListByLocation
41. https://dms-erp-aws-prd.geappliances.com/dms/newasis/getreporthistory

---

## Discovered Export Endpoints

### Agent Communication

**Page URL:** https://dms-erp-aws-prd.geappliances.com/dms/agentcommunication/search

#### Endpoint 1

```
Method: POST
URL: https://dms-erp-aws-prd.geappliances.com/dms/agentcommunication/downloadcasesummaryexcel
POST Data: hDssoDmsLoc=19SU&hSearchDssoDate=07-26-2025&hSearchDssoEndDate=01-22-2026&hCaseAssignedTo=AGENT&hCaseNumber=&hCaseType=ALL&hRmCode=ALL&isGeOther=&hMpOrgCde=&dmsLoc=19SU&rmCode=ALL&caseType=ALL&caseAssignedTo=AGENT&filter=&searchDssoDate=07-26-2025&searchDssoEndDate=01-22-2026

Key Headers:
  Referer: https://dms-erp-aws-prd.geappliances.com/dms/agentcommunication/search
  Content-Type: application/x-www-form-urlencoded
```

### Cycle Count / Physical Inventory

**Page URL:** https://dms-erp-aws-prd.geappliances.com/dms/cyclecount/invorgs

#### Endpoint 1

```
Method: POST
URL: https://xre0ihgog2.execute-api.us-east-1.amazonaws.com/prd/get_count_type
POST Data: {"current_screen":"Cycle Count PI - Inv Orgs","gead_user":{"sso":"515511228","user_authority":"AGENT"},"search_criteria":{"include_events":"ONLY"}}

Key Headers:
  Referer: https://dms-erp-aws-prd.geappliances.com/
  Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

#### Endpoint 2

```
Method: POST
URL: https://xre0ihgog2.execute-api.us-east-1.amazonaws.com/prd/get_loc_status
POST Data: {"current_screen":"Cycle Count PI - Inv Orgs","gead_user":{"sso":"515511228","user_authority":"AGENT"},"search_criteria":{"inv_org":"9SU"}}

Key Headers:
  Referer: https://dms-erp-aws-prd.geappliances.com/
  Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

#### Endpoint 3

```
Method: POST
URL: https://xre0ihgog2.execute-api.us-east-1.amazonaws.com/prd/get_loc_summary
POST Data: {"current_screen":"Cycle Count PI - Inv Orgs","gead_user":{"sso":"515511228","user_authority":"AGENT"},"search_criteria":{"inv_org":"9SU","inv_count_start_date":"","inv_event_start_date":""}}

Key Headers:
  Referer: https://dms-erp-aws-prd.geappliances.com/
  Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

### User List By Location

**Page URL:** https://dms-erp-aws-prd.geappliances.com/dms/users/userListByLocation

#### Endpoint 1

```
Method: POST
URL: https://dms-erp-aws-prd.geappliances.com/dms/users/userListByLocationExport
POST Data: REQUEST=DMS_AGENT_CUST&hAction=DISPLAY&hDmsLoc=&cbDmsLoc=19SU

Key Headers:
  Referer: https://dms-erp-aws-prd.geappliances.com/dms/users/userListByLocation
  Content-Type: application/x-www-form-urlencoded
```

