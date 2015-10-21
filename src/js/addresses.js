var $ = require('jquery');
var count = require('./count');
require('mapbox.js');
var leafletPip = require('leaflet-pip');

L.mapbox.accessToken = 'pk.eyJ1IjoiY29tcHV0ZWNoIiwiYSI6InMyblMya3cifQ.P8yppesHki5qMyxTc2CNLg';

// setup geocoder
var geocoder = L.mapbox.geocoder('mapbox.places');

module.exports = function() {
    var duplicates = [];

    // geocode the address using the census api
    // use _callback
    var geocode = function(address) {
        // api call
        geocoder.query(address, mapboxAPI.callback);
    };

    var isDuplicate = function(address) {
        if (duplicates.indexOf(address) !== -1) {
            var result = {};
            result.input = address;
            result.address = 'Duplicate';
            result.countyName = '-';
            result.block = '-';
            result.rural = '-';
            result.type = 'duplicate';
            return result;
        } else {
            duplicates.push(address);
            return false;
        }
    }

    var address = {};

    address.process = function(queries) {
        duplicates = [];

        $.each(queries, function(index, query) {
            var isDup = isDuplicate(query);

            // if its not dup
            if (!isDup) {
                // uses callback to finish processing
                geocode(query);
            } else {
                count.updateCount(isDup.type);
                address.render(isDup);
            }
        });
    }

    address.render = function(result) {
        var mapID = Date.now();

        var rowHTML = '<tr><td>' + result.input + '</td>'
            + '<td>' + result.address + '</td>'
            + '<td>' + result.countyName + '</td>'
            + '<td>' + result.block + '</td>'
            + '<td>' + result.rural;

        // add the map link if needed
        if(result.rural != '-') {
            // remove later
            rowHTML = rowHTML + ' ' + result.why;
            rowHTML = rowHTML
                + ' <a href="#" class="hide-print jsLoadMap right" data-state="' + result.state + '" data-map="false" data-lat="' + result.y + '" data-lon="' + result.x + '" data-id="loc-' + mapID + '">Show map <span class="cf-icon cf-icon-plus-round"></span></a>'
        }

        rowHTML = rowHTML
            + '</td></tr>'
            + '<tr class="hide"><td colspan="5"><div class="map" id="loc-' + mapID + '"></div></td></tr>';

        $('#' + result.type).removeClass('hide');
        $('#' + result.type + ' tbody').append(rowHTML);
    }

    address.isFound = function(response) {
        if (response.features.length === 0) {
            var result = {};
            result.input = address.getInput(response.query);
            result.address = 'Address not identfied';
            result.countyName = '-';
            result.block = '-';
            result.rural = '-';
            result.type = 'notFound';
            return result;
        } else {
            return false;
        }
    }

    address.getInput = function(query) {
        var input = '';
        $.each(query, function(index, value){
            input = input + ' ' + value;
        });

        return input;
    }

    // rural check
    address.isRural = function(mapbox, year) {
        var result = {};

        // we have something so start setting up the result
        result.input = address.getInput(mapbox.results.query);
        result.address = mapbox.results.features[0].place_name;
        result.x = mapbox.results.features[0].center[1];
        result.y = mapbox.results.features[0].center[0];

        $.ajax({
            url: 'http://data.fcc.gov/api/block/find',
            dataType: 'jsonp',
            data: {
                latitude: result.x,
                longitude: result.y,
                showall: true,
                format: 'jsonp'
            },
            success: function load(fcc) {
                var state = fcc.State.code.toLowerCase();
                result.state = state;
                result.block = fcc.Block.FIPS;
                //fipsCode = fcc.County.FIPS;

                result.countyName = fcc.County.name;
                result.countyFIPS = fcc.County.FIPS;

                $.ajax({
                    url: 'data/' + year + '.json',
                    dataType: 'json',
                    success: function load(fips) {
                        var inCounty = false;
                        $.each(fips.fips, function(key, val) {
                            if (val[0] === result.countyFIPS) {
                                console.log(result.countyFIPS + ' = ' + val[0] + ' and ' + val[1] + ' and ' + result.address);
                                inCounty = true;
                                result.rural = 'Yes';
                                result.type = 'rural';
                                result.why = 'county';
                                console.log(result);
                                address.render(result);
                                count.updateCount(result.type);
                            }
                        });

                        if (!inCounty) {
                            // load geoson
                            $.ajax({
                                url: 'geojson/' + state + '.geojson',
                                dataType: 'json',
                                success: function load(d) {
                                    var gjLayer = L.geoJson(d);
                                    var inPoly = leafletPip.pointInLayer([result.y, result.x], gjLayer, true);
                                    if (inPoly.length === 0) {
                                        result.rural = 'Yes';
                                        result.type = 'rural';
                                        result.why = 'pip';
                                    } else {
                                        result.rural = 'No';
                                        result.type = 'notRural';
                                    }
                                    address.render(result);
                                    count.updateCount(result.type);
                                }
                            });
                        }
                    }
                });
            }
        })
        .fail(function(jqXHR, textStatus) {
          console.log(textStatus);
        });
    }

    return address;
}();