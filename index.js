/********************************************************************************************************************|
|Purpose: Webhook to integrate Dialogflow with Salesforce.                                                           |
|--------------------------------------------------------------------------------------------------------------------|
|History                                                                                                             |   
|------------------------------------------------------------------------------------------------------------------- |
|Version |     Date      | Author | Description                                                                      |
|--------------------------------------------------------------------------------------------------------------------|
|1.0     |  04-12-2019   | Sumit  |usage of node-salesforce api which calls native salesforce api for CRUD operations| 
|                                                                                                                    |
|                                                                                                                    |
|--------------------------------------------------------------------------------------------------------------------|
|********************************************************************************************************************/

"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const sf = require('node-salesforce');
const restService = express();
var accountId = null;
var isUserResponseNeeded = true;
restService.use(
	bodyParser.urlencoded({
		extended: true
	})
);

restService.use(bodyParser.json());
restService.listen(process.env.PORT || 3000, () => console.log('[KPN ESMEE BOT] Webhook is listening'));
restService.post("/webhook", async(req, res) => {
	var speech =
		req.body.queryResult &&
		req.body.queryResult.parameters &&
		req.body.queryResult.parameters.ID ?
		req.body.queryResult.parameters.ID :
		"Seems like some problem. Speak again.";

	var intent = req.body.queryResult.intent.displayName;
	console.log(intent);
	var conn = new sf.Connection({
		oauth2: {
			loginUrl: 'https://login.salesforce.com',
			clientId: '3MVG95G8WxiwV5PsGBFxENG1dYTpFMNNSR4wcSKPFki.JJjHGty7AGKuIFPiC0_uvKKW1a2pFp9ZVvDSooi9Z',
			clientSecret: '7DCC0E6BA3AD4AE7DCFAF1AC2F1CA5E7895F5AC2A5E588FE7663FAF0DC8BA275',
			redirectUri: 'https://login.salesforce.com/services/oauth2/token'
		},
		instanceUrl: 'https://login.salesforce.com',
		accessToken: '<your Salesforrce OAuth2 access token is here>',
		refreshToken: '<your Salesforce OAuth2 refresh token is here>'
	});
	await conn.login('shashank.shekhar@kpn.com.hackathon', 'Kpn12345gpfLpSVJCQIABHNjM3pQhNu00', function (err, userInfo) {
		if (err) {
			return console.error('login error:' + err);
		}
		console.log('Instance URL :' + conn.instanceUrl);
		console.log('Access Token :' + conn.accessToken);
	});


	if (intent == 'check_subscription') {
		var records = [];
		await conn.query("SELECT Id, Name,Existing_Subscriptions__c,Bill_due_date__c,Latest_bill_amount__c FROM Account where CustomerId__c = '" + req.body.queryResult.parameters.ID + "'",
			function (err, result) {
				if (err) {
					return console.error('query error:' + err);
				}
                if(result.totalSize>0) {
                accountId = result.records[0].Id;
                speech = 'Hi, '+ result.records[0].Name+' Thank you for the information.' +
                        ' I see you are holding  '+result.records[0].Existing_Subscriptions__c+ ' with KPN.'+
                        ' We are here to help you. Do you have any Concern ?';}
                else  {
                speech = 'Seems like some problem. Speak again.'; 
                isUserResponseNeeded = true;   
                }
				console.log(speech);
			}
		);
	} else if (intent == 'comment_about_subscription_no') {
		var caseid = null;
		console.log('ID account ' + accountId);
		await conn.sobject("Case").create({
			AccountID: accountId,
			Subject: req.body.queryResult.parameters.SUBJECT,
			Origin: 'Chatbot',
			Status: 'New'
		}, function (err, ret) {
			if (err || !ret.success) {
				return console.error(err, ret);
			}
			caseid = ret.id;
			console.log("Created record id : " + ret.id);
		});

		var records = [];
		if (caseid) {
			await conn.query("SELECT CaseNumber FROM Case where id = '" + caseid + "'",
				function (err, result) {
					if (err) {
						return console.error('query error:' + err);
					}
					speech = 'Sad to hear that. I have logged a case for your concern.' +
						' Your case number is :' + result.records[0].CaseNumber +
						' One of our Agents will get back you within 48 hrs.' +
                        ' I hope this solves your problem.';
                    isUserResponseNeeded = false;
					console.log(speech);
				}
			);
		}

	} else if (intent == 'new_customer') {

		await conn.sobject("Lead").create({
			Description: req.body.queryResult.parameters.SUBSTYPE,
			Company: req.body.queryResult.parameters.LASTNAME,
			LastName: req.body.queryResult.parameters.LASTNAME,
			Phone: req.body.queryResult.parameters.PHONENUMBER,
			Status: 'Open - Not Contacted',
            Street: req.body.queryResult.parameters.ADDRESS,
            LeadSource: 'Chatbot'    
		}, function (err, ret) {
			if (err || !ret.success) {
				return console.error(err, ret);
			}
            speech = 'Thankyou for your interest in KPN. I have registered your detials one of our Agent\'s will reach you shortly.';
            isUserResponseNeeded = fasle;
            console.log("Created Lead record with id : " + ret.id);
            console.log(speech);
		});

	}

	var speechResponse = {
		google: {
			expectUserResponse: isUserResponseNeeded,
			richResponse: {
				items: [{
					simpleResponse: {
						textToSpeech: speech
					}
				}]
			}
		}
	};

	return res.json({
		payload: speechResponse,
		//data: speechResponse,
		fulfillmentText: speech,
		speech: speech,
		displayText: speech,
		source: "webhook"
	});
});