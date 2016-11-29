import { name } from '../../package.json';
import { version } from '../../package.json';
import { Router } from 'express';
import strSimilarity from 'string-similarity';

import cities from '../../json/cities.json';
import NearBySearch from 'googleplaces/lib/NearBySearch';

const CITY_LIMIT = 10;

let baseResponse = {
  name,
  version
};

let getPossibleDupes = function(res) {
  var i, ii, c,
      considerations = ['name', 'vicinity'],
      resultsLength = res.results.length;

  let similarities = {};

  for (i = 0; i < resultsLength; i++) {
    let combined1 = [],
        sim      = [];

    for (c = 0; c < considerations.length; c++) {
      combined1.push(res.results[i][considerations[c]]);
    }

    for (ii = 0; ii < resultsLength; ii++) {
      let combined2 = [],
          score;

      if (i === ii) {
        continue;
      }

      for (c = 0; c < considerations.length; c++) {
        combined2.push(res.results[ii][considerations[c]]);
      }

      score = strSimilarity.compareTwoStrings(combined1.join(' '), combined2.join(' '));

      if (score >= 0.8) {
        sim.push({
          place1 : combined1.join(' '),
          place2 : combined2.join(' '),
          score  : score
        });
      }
    }

    if (sim.length > 0) {
      similarities[res.results[i].place_id] = sim;
    }
  }

  return similarities;
};

export default () => {
  let api = Router();

  api.get('/', (req, res) => {
    res.json(baseResponse);
  });

  api.get('/source', (req, res) => {
    res.json(Object.assign({}, baseResponse, {
      i_limit     : CITY_LIMIT,
      description : 'top ' + CITY_LIMIT + ' cities by population (2013)',
      cities      : cities.splice(0, CITY_LIMIT)
    }));
  });

  api.get('/search', (req, res) => {
    let googleApiKey = req.query.hasOwnProperty('google_api_key') ? req.query.google_api_key : '',
        nearBySearch,
        i = req.query.hasOwnProperty('i') ? req.query.i : 0,
        parameters = {
          i,
          keyword         : req.query.hasOwnProperty('keyword') ? req.query.keyword : '',
          location        : [cities[i].latitude, cities[i].longitude],
          rankby          : 'distance'
        };

    if (!googleApiKey) {
      res.json(Object.assign({}, baseResponse, {
        error: 'No google_api_key provided'
      }));

      return;
    }

    nearBySearch = new NearBySearch(googleApiKey, 'json');
    nearBySearch(Object.assign({}, parameters), function(err, resSearch) {
      res.json(Object.assign({}, baseResponse, {
        city_name           : cities[i].city,
        city_rank           : parseInt(cities[i].rank, 10),
        city_population     : parseInt(cities[i].population, 10),
        parameters,
        people_per_result   : cities[i].population / resSearch.results.length,
        possible_duplicates : getPossibleDupes(resSearch),
        result              : resSearch
      }));
    });
  });

  return api;
};
