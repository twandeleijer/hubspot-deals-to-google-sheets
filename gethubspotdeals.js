function getDeals() {
  // Input variables
  var hapikey = "demo"; // The API key for your Hubspot portal
  var properties = ["pipeline","amount","createdate","closedate","dealname","hubspot_owner_id"];
  var propertiesWithHistory = ["dealstage"];
  var pipelineId = ""; // The ID of the pipeline to fetch the data for

  // Put the pipelines into an object
  var pipelinesRequestUrl = "https://api.hubapi.com/crm-pipelines/v1/pipelines/deals?hapikey=" + hapikey;
  var pipelinesResponse = UrlFetchApp.fetch(pipelinesRequestUrl);
  var pipelines = JSON.parse(pipelinesResponse.getContentText()).results;
  var pipelineStages = fetchPipelineStages(pipelineId);

  // Set the columns headers
  var columnHeaders = ["portalId","dealId","isDeleted"]; // These are the standard fields that the Deals API provides

  var propertiesUrlParams = "";
  properties.forEach(function(property){
    propertiesUrlParams += "&properties=";
    propertiesUrlParams += property;
    columnHeaders.push(property); // Add the requested properties to the columnheaders
  });

  propertiesWithHistory.forEach(function(property){
    propertiesUrlParams += "&propertiesWithHistory=";
    propertiesUrlParams += property;
    columnHeaders.push(property); // Add the requested properties with history to the column header
  });

  pipelineStages.forEach(function(stage){
    var stageLabel = stage.label;
    var columnHeader = stageLabel + " - Date";
    columnHeaders.push(columnHeader); // Add the requested dealstage history fields to the columnheader
  });

  pipelineStages.forEach(function(stage){
    if(stage.metadata.isClosed === "false"){
      var stageLabel = stage.label;
      var columnHeader = stageLabel + " - Time in Stage";
      columnHeaders.push(columnHeader); // Add the requested dealstage history fields to the columnheader
    }
  });

  // Initialize an array to store the deals into
  var dealsArray = Array();
  dealsArray.push(columnHeaders); // Push the column header into this array

  // Function for later to replace the pipelineId with a human readable label
  function printPipelineLabel(pipelineIdFilter) {
    var label = pipelines.filter(
      function(p){
        return (p.pipelineId===pipelineIdFilter);
      }
    )[0].label;
    return label;
  }

  // Function to pull the stages for the specified pipeline and put them in order
  function fetchPipelineStages(pipelineIdFilter){
    var stages = pipelines.filter(function(pipeline){return (pipeline.pipelineId === pipelineIdFilter);} )[0].stages;
    stages.sort(function(a, b){return a.displayOrder - b.displayOrder});
    return stages;
  }

  // Function for later to replace the dealstageId with a human readable label
  function dealstageLabel(pipelineIdFilter,dealstageId){
    var pipelineObject = pipelines.filter(function(pipeline){return (pipeline.pipelineId === pipelineIdFilter);} )[0];
    var stages = pipelineObject.stages;
    var stageLabel = stages.filter(function(stage){return (stage.stageId===dealstageId);} )[0].label;
    return stageLabel;
  }

  // Function to transform timestamps into datevalues that Google Sheets understands
  function printDateTime(timestamp) {
    var inputTimestamp = parseInt(timestamp); // convert the timestamp to an integer
    var timeStampOffset = 2209161600000; // Google Sheets uses a different date system, therefore we should adjust the timestamp by adding the "missed" milliseconds from 1899-12-30 00:00:00
    var millisecondsToDays = 1000 * 60 * 60 * 24; // The amount of milliseconds per day
    var gsheetsDatevalue = (inputTimestamp + timeStampOffset) / millisecondsToDays
    return gsheetsDatevalue;
  }

  // This while loop will go through the paginated API response, until it has fetched all results
  var hasMore = true;
  var offset = 0;
  while(hasMore) {
    var url = "https://api.hubapi.com/deals/v1/deal/paged?hapikey=" + hapikey + propertiesUrlParams + "&limit=250&offset=" + offset;
    var response = UrlFetchApp.fetch(url);
    var result = JSON.parse(response.getContentText());
    hasMore = result.hasMore;
    offset = result.offset;

    // Loop through the deals
    result.deals.forEach(function(deal) {

      // Initialize an empty array to store the deal's details into
      var dealArray = Array();

      // Fetch the standard properties
      var portalId = deal.portalId;
      var dealId = deal.dealId;
      var isDeleted = deal.isDeleted;
      dealArray.push(portalId,dealId,isDeleted);

      // Fetch the additional properties requested
      properties.forEach(function(property){
        if(property === "pipeline"){
          var pipelineValue = (deal.properties.hasOwnProperty(property)) ? deal.properties[property].value : "";
          var propertyValue = printPipelineLabel(pipelineValue);
        }
        else if(property.indexOf('date') !== -1){
          var dateValue = (deal.properties.hasOwnProperty(property)) ? deal.properties[property].value : "";
          var propertyValue = printDateTime(dateValue);
        }
        else if (property === 'dealstage'){
          var pipelineValue = (deal.properties.hasOwnProperty('pipeline')) ? deal.properties['pipeline'].value : "";
          var dealStageValue = (deal.properties.hasOwnProperty(property)) ? deal.properties[property].value : "";
          var propertyValue = dealstageLabel(pipelineValue,dealStageValue);
        }
        else {
          var propertyValue = (deal.properties.hasOwnProperty(property)) ? deal.properties[property].value : "";
        }
        dealArray.push(propertyValue);
      });

      // Fetch the current value for the properties with history
      propertiesWithHistory.forEach(function(property){
        if (property === 'dealstage'){
          var pipelineValue = (deal.properties.hasOwnProperty('pipeline')) ? deal.properties['pipeline'].value : "";
          var dealStageValue = (deal.properties.hasOwnProperty(property)) ? deal.properties[property].value : "";
          var propertyValue = dealstageLabel(pipelineValue,dealStageValue);
        } else {
          var propertyValue = (deal.properties.hasOwnProperty(property)) ? deal.properties[property].value : "";
        }
        dealArray.push(propertyValue);
      });

      // Fetch the historic values for the properties with history
      pipelineStages.forEach(function(stage){
        var stageId = stage.stageId;
        var stagesHistory = deal.properties.dealstage.versions;
        try { var stageDate = printDateTime(stagesHistory.filter(function(version){return (version.value===stageId);} )[0].timestamp); }
        catch(err) {var stageDate = "";}
        dealArray.push(stageDate);
      });

      // Calculate the time (in days) a deal stayed in each stage
      // First, let's add the time in each stage to the dealstages history
      var stageVersions = deal.properties.dealstage.versions;
      stageVersions.forEach(function(version, index){
        if(index>0){
          var t1 = version.timestamp;
          var t2 = stageVersions[index-1].timestamp;
          var timeInStage = t2 - t1;
          var daysInStage = timeInStage / 1000 / 60 / 60 / 24;
          version.timeInStage = daysInStage;
        } else {
          var t1 = version.timestamp;
          var t2 = Date.now();
          var timeInStage = t2 - t1;
          var daysInStage = timeInStage / 1000 / 60 / 60 / 24;
          version.timeInStage = daysInStage;
        }
      });
      // Second, loop through the stages of the pipeline and sum the amount of days
      pipelineStages.forEach(function(stage){
        if(stage.metadata.isClosed === "false"){
          var stageId = stage.stageId;
          var stagesHistory = deal.properties.dealstage.versions;
          try { var stageTime = stagesHistory.filter(function(version){return (version.value===stageId);} )[0].timeInStage; }
          catch(err) {var stageTime = "";}
          dealArray.push(stageTime);
        }
      });

      // Push the deal into the deals array, depending on if the pipeline is set
      var pipelineValue = (deal.properties.hasOwnProperty('pipeline')) ? deal.properties.pipeline.value : "";
      if (pipelineValue === pipelineId){
        dealsArray.push(dealArray);
      };
    });
   }
  return dealsArray;
}

function writeDeals() {
  var sheetNameDeals = "HubSpotDeals"; // Set the name of the sheet
  var deals = getDeals(); // Fetch the deal data
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetNameDeals);
  if (sheet == null){
    ss.insertSheet(sheetNameDeals); // Create sheet if it doesn't already exist
  };
  sheet.clear(); // Clear the data from the sheet, to start from a clean slate
  // Writing the table to the spreadsheet
  var range = sheet.getRange(1,1,deals.length,deals[0].length);
  range.setValues(deals);
}
