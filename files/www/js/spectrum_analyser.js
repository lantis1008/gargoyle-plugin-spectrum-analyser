/*
 * This program is copyright © 2015 Michael Gray and is distributed under the terms of the GNU GPL 
 * version 2.0 with a special clarification/exception that permits adapting the program to
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL.
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */
var spectrum=new Object(); //part of i18n

var updatePlot = null;
var updateInProgress = false;
var interfaces;
var freq_low;
var freq_high;
var detected;

// Xband = [[channel #],[centre freq],[low freq],[high freq]]
var gband = [	
				[1,2,3,4,5,6,7,8,9,10,11,12,13,14],
				[2.412,2.417,2.422,2.427,2.432,2.437,2.442,2.447,2.452,2.457,2.462,2.467,2.472,2.484],
				[2.401,2.406,2.411,2.416,2.421,2.426,2.431,2.436,2.441,2.446,2.451,2.456,2.461,2.473],
				[2.423,2.428,2.433,2.438,2.443,2.448,2.453,2.458,2.463,2.468,2.473,2.478,2.483,2.495]
			]
var aband = [
				[36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140,149,153,157,161,165],
				[5.180,5.200,5.220,5.240,5.260,5.280,5.300,5.320,5.500,5.520,5.540,5.560,5.580,5.600,5.620,5.640,5.660,5.680,5.700,5.745,5.765,5.785,5.805,5.825],
				[5.170,5.190,5.210,5.230,5.250,5.270,5.290,5.310,5.490,5.510,5.530,5.550,5.570,5.590,5.610,5.630,5.650,5.670,5.690,5.735,5.755,5.775,5.795,5.815],
				[5.190,5.210,5.230,5.250,5.270,5.290,5.310,5.330,5.510,5.530,5.550,5.570,5.590,5.610,5.630,5.650,5.670,5.690,5.710,5.755,5.775,5.795,5.815,5.835]
			]

function initialiseAll()
{
	var ivalues = [];
	var inames = [];
	//First, we should adjust the drop down list for the interfaces. We should identify which ones are 2.4 and 5ghz as well.
	interfaces = parseInterfaces(wifiLines);
	for(var x = 0; x < 2; x++)
	{
		ivalues.push(interfaces[x][0]);
		inames.push(interfaces[x][1]);
	}
	setAllowableSelections('interface', ivalues, inames);
	
	initialisePlots();
	
	getWifiData();
}


function initialisePlots()
{
	var band = interfaces[document.getElementById("interface").selectedIndex][1];
	if(band == "2.4GHz")
	{
		freq_low = 2.4;		//technically 2.401, but 2.400 graphs better
		freq_high = 2.5;		//technically 2.495, but 2.500 graphs better
	}
	else
	{
		freq_low = 5.170;
		freq_high = 5.835;
	}
	
	var spect = d3.select("#spectrum_plot"), 
		WIDTH = 500, 
		HEIGHT = 400, 
		MARGINS = 
		{ 
			top: 20, 
			right: 20, 
			bottom: 20, 
			left: 50
		},
		xScale = d3.scale.linear().range([MARGINS.left, WIDTH - MARGINS.right]).domain([freq_low,freq_high]),
		yScale = d3.scale.linear().range([HEIGHT - MARGINS.top, MARGINS.bottom]).domain([-100,0]),
		xAxis = d3.svg.axis().scale(xScale),
		yAxis = d3.svg.axis().scale(yScale);
		
	xAxis = d3.svg.axis()
		.scale(xScale)
		.tickValues(gband[1])
		.tickFormat(function(d) { a = gband[1].indexOf(d); return gband[0][a]; }),
  
	yAxis = d3.svg.axis()
		.scale(yScale)
		.orient("left");
	
	spect.append("svg:g")
		.attr("class","axis")
		.attr("transform", "translate(0," + (HEIGHT - MARGINS.bottom) + ")")
		.call(xAxis);
	spect.append("svg:g")
		.attr("class","axis")
		.attr("transform", "translate(" + (MARGINS.left) + ",0)")
		.call(yAxis);
		
		
		// SAMPLE DATA
		/*var data = [{
			"level": "-100",
			"freq": "2.426"
		}, {
			"level": "-50",
			"freq": "2.427"
		}, {
			"level": "-50",
			"freq": "2.447"
		}, {
			"level": "-100",
			"freq": "2.448"
		}];
		
		var lineGen = d3.svg.line()
			.x(function(d) {
			return xScale(d.freq);
			})
			.y(function(d) {
			return yScale(d.level);
			});
		  
		spect.append('svg:path')
			.attr('d', lineGen(data))
			.attr('stroke', 'green')
			.attr('stroke-width', 2)
			.attr('fill', 'none');*/
			
}

function parseInterfaces(lines)
{
	if(lines.length == 0) { return []; }
	
	var interfaceData = [];
	lineIndex = 0;
	for(lineIndex=0; lineIndex < lines.length; lineIndex++)
	{
		var nextLine = lines[lineIndex];
		var wlan = nextLine.split(" ");
		
		var interfaceid = wlan[0];
		if(wlan[1] > 14)
		{
			var interfaceband = "5GHz";
		}
		else
		{
			var interfaceband = "2.4GHz";
		}
		
		interfaceData.push( [ interfaceid, interfaceband ] );
	}
	return interfaceData;
}


function getWifiData()
{
	var Commands = [];
	var parsedWifiData = [];
	
	Commands.push("iw wlan0 scan 2>&1 | awk -F'\\\n' '{print \"\\\"\"$0\"\\\"\" }'");
	
	var param = getParameterDefinition("commands", Commands.join("\n")) + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));		
	var stateChangeFunction = function(req)
	{
		if (req.readyState == 4)
		{
			var shell_output = req.responseText.replace(/Success/, "");
			shell_output = shell_output.replace(/\"/g,"");
			parsedWifiData = parseWifiData(shell_output);
			generateGraphData(parsedWifiData);
		}
	}
	runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
}

function parseWifiData(rawScanOutput)
{
	if((rawScanOutput != null) && (rawScanOutput != "\n") && (rawScanOutput != "\r"))
	{
		var parsed = [ [],[],[],[],[] ];
		var cells = rawScanOutput.split(/BSS [A-Fa-f0-9]{2}[:]/g);
		cells.shift(); //get rid of anything before first AP data
			
		var getCellValues=function(id, cellLines)
		{
			var vals=[];
			var lineIndex;
			for(lineIndex=0; lineIndex < cellLines.length; lineIndex++)
			{
				var line = cellLines[lineIndex];
				var idIndex = line.indexOf(id);
				var cIndex  = line.indexOf(":");
				var eqIndex = line.indexOf("=");
				var splitIndex = cIndex;
				if(splitIndex < 0 || (eqIndex >= 0 && eqIndex < splitIndex))
				{
					splitIndex = eqIndex;
				}
				if(idIndex >= 0 && splitIndex > idIndex)
				{
					var val=line.substr(splitIndex+1);
					val = val.replace(/^[^\"]*\"/g, "");
					val = val.replace(/\".*$/g, "");
					val = val.replace(/^[ ]/g,"");
					val = val.replace(/ dBm/g,"");
					vals.push(val);
				}
			}
			return vals;
		}

		while(cells.length > 0)
		{
			var cellData  = cells.shift();
			var cellLines = cellData.split(/[\r\n]+/);
			
			var ssid    = getCellValues("SSID", cellLines).shift();
			var prichannel = getCellValues("primary channel", cellLines).shift();
			var secchannel = getCellValues("secondary channel offset", cellLines).shift();
			var sigStr = getCellValues("signal", cellLines).shift();



			if(ssid != null && prichannel != null && secchannel != null && sigStr != null ) 
			{			
				parsed[0].push(ssid);
				parsed[1].push(prichannel);
				parsed[2].push(secchannel);
				parsed[3].push(sigStr);
				parsed[4].push( prichannel > 30 ? "5GHz" : "2.4GHz")
			}
		}

		return parsed;
	}
	else
	{
		return(-1);
	}
}

function generateGraphData(detected)
{
	var selectedband = interfaces[document.getElementById("interface").selectedIndex][1];
	var plotdata = [];
	for(x = 0; x < detected[0].length; x++)
	{
		var SSID = detected[0][x];
		var channel = detected[1][x];
		var secondary = detected[2][x];
		var level = detected[3][x];
		var band = detected[4][x];
		///////////////////////////////////////////////////THIS BIT NEEDS MORE USE CASES//////////////////////////////////////////		
		if(secondary == "no secondary")
		{
			plotdata[x*4] = {"ssid":SSID, "level":"-100", "freq":getfreqData(channel,2).toString()};
			plotdata[x*4+1] = {"ssid":SSID, "level":level.toString(), "freq":(getfreqData(channel,2)+0.001).toString()};
			plotdata[x*4+2] = {"ssid":SSID, "level":level.toString(), "freq":(getfreqData(channel,3)-0.001).toString()};
			plotdata[x*4+3] = {"ssid":SSID, "level":"-100", "freq":getfreqData(channel,3).toString()};
		}
	}
	
	plotall(plotdata);
}

function getfreqData(channel,info)
{
	//info = 1, return centrefreq	info = 2, return lowfreq	info = 3, return highfreq
	if(channel > 14)
	{
		//5ghz
	}
	else
	{
		a = gband[0].indexOf(parseInt(channel));
		return gband[info][a];
	}
}

function plotall(plotdata)
{
	var maxsig = -150;
	for (x = 0; x < plotdata.length; x++)
	{
		if(plotdata[x].level > maxsig)
		{
			maxsig = plotdata[x].level - (-10);
		}
	}
	if(maxsig > 0)
	{
		maxsig = 0;
	}
	
	var dataGroup = d3.nest()
		.key(function(d) {return d.ssid;
		})
		.entries(plotdata);
	
	var spect = d3.select("#spectrum_plot"), 
		WIDTH = 500, 
		HEIGHT = 400, 
		MARGINS = 
		{ 
			top: 20, 
			right: 20, 
			bottom: 20, 
			left: 50
		},
		xScale = d3.scale.linear().range([MARGINS.left, WIDTH - MARGINS.right]).domain([freq_low,freq_high]),
		yScale = d3.scale.linear().range([HEIGHT - MARGINS.top, MARGINS.bottom]).domain([-100,maxsig]),
		xAxis = d3.svg.axis().scale(xScale),
		yAxis = d3.svg.axis().scale(yScale);
		
	spect.selectAll(".axis").remove();	//kill the old axes
		
	xAxis = d3.svg.axis()
		.scale(xScale)
		.tickValues(gband[1])
		.tickFormat(function(d) { a = gband[1].indexOf(d); return gband[0][a]; }),
  
	yAxis = d3.svg.axis()
		.scale(yScale)
		.orient("left");
	
	spect.append("svg:g")
		.attr("class","axis")
		.attr("transform", "translate(0," + (HEIGHT - MARGINS.bottom) + ")")
		.call(xAxis);
	spect.append("svg:g")
		.attr("class","axis")
		.attr("transform", "translate(" + (MARGINS.left) + ",0)")
		.call(yAxis);
		
	var lineGen = d3.svg.line()
			.x(function(d) {
			return xScale(d.freq);
			})
			.y(function(d) {
			return yScale(d.level);
			});
		
	dataGroup.forEach(function(d, i) {
		spect.append('svg:path')
        .attr('d', lineGen(d.values))
        .attr('stroke', function(d, j) {
            return "hsl(" + Math.random() * 360 + ",100%,50%)";
        })
        .attr('stroke-width', 2)
        .attr('fill', 'none');
	});
}