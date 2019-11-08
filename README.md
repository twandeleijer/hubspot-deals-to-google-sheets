# Hubspot Deals importer for Google Sheets

This importer written for Google Scripts imports all deals from the specified pipeline, including historic dealstage data for analytics and reporting purposes.

## Requirements

* Access to Google Sheets
* A Hubspot API key
* The ID of the pipeline

## Installation steps

1. Open a new Google Sheet
2. Click `Tools` > `Script editor`
3. Paste the code from `gethubspotdeals.js` into the code editor (remove all existing code)
4. On line 3, enter your Hubspot API key between the quotes.
5. On line 6, enter the ID for the pipeline you'd like to pull the deals data from
6. (Optional) On line 4 you can add additional deal properties that you'd like to import
7. Under `Select function`, select `writeDeals` and click the play button. This will execute the code and if all goes well, a new sheets, called `HubSpotDeals` will be added to your spreadsheet containing the deal data
8. (Optional) If you'd like to automatically refresh the data (in case you're using this data to drive a dashboard), you can set up triggers under `Edit` > `Current project's triggers`
