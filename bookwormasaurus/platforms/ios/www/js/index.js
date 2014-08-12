/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// storage of twitter oauth user tokens
// this isn't secure or appropriate for real applications
// this is for demonstation purposes
var twitter_tokens = {
    oauth_token: "",
    oauth_token_secret: ""
}

// local sqlite db
var db;

// oauth result
var oauth_result;

// nytimes storage
var nytimes_data;

// helper
function hasWhiteSpace(s) {
  return s.indexOf(' ') >= 0;
}

var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
        app.oAuthLinkSetup();
        app.resetLinkSetup();
        app.setupDb();
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    },
    oAuthLinkSetup: function() {
        var parentElement = document.getElementById('deviceready');
        var receivedElement = parentElement.querySelector('.received');

        receivedElement.addEventListener("click", function() {
            oauth.initialize();
        }, false);
    },
    resetLinkSetup: function() {
        var parentElement = document.getElementById('reset');

        parentElement.addEventListener("click", function() {
            // hide views if shown
            $('.goodreads').fadeOut();
            $('.nytimes').fadeOut();
            $('.tweets').fadeOut();

            // clear value
            $('#searchBox').val("");

            // show app
            $('.app').fadeIn();

            // init
            oauth.initialize();
        }, false);
    },
    setupDb: function() {
        db = window.sqlitePlugin.openDatabase({name: "user.db"});
        db.transaction(queryDB, errorCB);
        function queryDB(tx) {
            tx.executeSql('CREATE TABLE IF NOT EXISTS user (oauth_token, oauth_token_secret)');
        }
        function errorCB(err) {
            alert('Unable to create user table in local Db.');
        }
    }
};

// http://oauth.io
var oauth = {
    initialize: function() {
        // initialize oauth.io
        OAuth.initialize(keys.oauth);

        // get current user tokens
        db.transaction(queryDB, errorCB);
        function queryDB(tx) {
            tx.executeSql('select oauth_token, oauth_token_secret from user', [], querySuccess, errorCB);
        }
        function errorCB(err) {
            alert(err);
        }
        function querySuccess(tx, results) {
            console.log(results);

            // skip oauth if we already have tokens
            // note: currently tokens do not expire, they may in the future
            if (results.rows.item(0) === undefined) {

                // start oauth for twitter
                OAuth.popup('twitter', {cache: true}).done(function(result) {
                    
                    // save user info to local storage
                    result.me().done(function (user_info) {
                        console.log("user_info:",user_info);  // for debugging
                        localStorage.setItem("name", user_info.name);
                    });

                    // set/save tokens
                    twitter_tokens.oauth_token = result.oauth_token;
                    twitter_tokens.oauth_token_secret = result.oauth_token_secret;

                    // set/save tokens to db
                    db.transaction(queryDB, errorCB);
                    function queryDB(tx) {
                        tx.executeSql('INSERT INTO user (oauth_token, oauth_token_secret) VALUES("'+
                            twitter_tokens.oauth_token+'", "'+
                            twitter_tokens.oauth_token_secret+'")');
                    }
                    function errorCB(err) {
                        alert('Unable to insert tokens into user table in local Db.');
                    }

                    // make sure we have tokens before continuing
                    if ( twitter_tokens.oauth_token !== "" ) {
                        // hide initial view
                        $('.app').hide();

                        // initialize nytimes
                        nytimes.initialize();
                    }
                });
            } else {
                // hide initial view
                $('.app').hide();

                // initialize nytimes
                nytimes.initialize();  
            }
        }
    }
};

// http://developer.nytimes.com/docs/best_sellers_api/
var nytimes = {
    initialize: function() {
        // show display
        $('.nytimes').show(10, function() {
            nytimes.getListOverview();
        });
    },
    getListOverview: function() {
        // get overview from nytimes best seller api
        $.ajax({
                dataType: 'json',
                type: 'GET',
                url: "http://api.nytimes.com/svc/books/v2/lists/overview.json?api-key="+keys.nytimes, 
                beforeSend: function(xhr) {
                    $.blockUI({ message: "Loading NYTimes Data" }); 
                },
                complete: function (xhr, status) {
                    $.unblockUI();
                },
                success: function( data ) {
                      $.each( data, function( k, v ) {
                        // the 'results' object is the one we care about
                        if (k === "results") {
                            nytimes_data = v;
                        }
                      });
                    nytimes.parseData();
                }
        });
    },
    // parse the data returned from the api
    parseData: function() {
        var nytimeslists = [];
        // iterate the data, saving the 'display_name'
        $.each(nytimes_data.lists, function(k,v) {
            nytimeslists.push(nytimes_data.lists[k]['display_name']);
        });
        nytimes.setupAutocomplete(nytimeslists);
    },
    // get our autocomplete box setup
    setupAutocomplete: function(lists) {
        $("#searchBox").autocomplete({
            target: $('#suggestions'),
            source: lists,
            minLength: 1,
            matchFromStart: false,
            // replace box text
            callback: function(e) {
                var $a = $(e.currentTarget);
                $('#searchBox').val($a.text());
                $("#searchBox").autocomplete('clear');
                $("#searchBox").autocomplete('destroy');
                
                $(".nytimes").fadeOut(500, function() {
                    $(".tweets").fadeIn();
                });

                nytimes.setupTwitterSearchTerms();
            }
        });
    },
    // get book titles and authors from selected subject
    setupTwitterSearchTerms: function() {
        var currently_selected = $('#searchBox').val();
        var books_authors = [];

        $.each(nytimes_data.lists, function(k,v) {
            if (nytimes_data.lists[k]['display_name'] === currently_selected) {
                // get book titles for selected subject
                $.each(nytimes_data.lists[k]['books'], function(i,p) {
                    // use author as well if string is one word
                    if ( hasWhiteSpace(p['title']) === false ) {
                        var title_and_author = p['title'].toLowerCase()+ " " +p['author'].toLowerCase();
                        books_authors.push(title_and_author);
                    } else {
                        books_authors.push(p['title'].toLowerCase());
                    }
                    
                });
            }
        });

        twitter.initialize();
        twitter.formSearchQuery(books_authors);
    }
}

var twitter = {
    initialize: function() {
        // maybe use name in the future for something
        var name = localStorage.getItem("name");
    },
    // https://dev.twitter.com/docs/using-search
    formSearchQuery: function(array_of_books_and_authors) {
        var searchQuery = "";

        // max 5 elements for max 10 keywords per docs
        for (i = 0; i < 5; i++) {
            if ( i === 0 ) {
                searchQuery = '"' +array_of_books_and_authors[i]+ '"';
            } else {
                searchQuery += " OR " + '"' +array_of_books_and_authors[i]+ '"';
            }
        }

        // add a requirement for "book" to be included
        searchQuery += " book";
        
        // search query before encoding
        console.log(searchQuery);

        twitter.makeRequest(encodeURIComponent(searchQuery));
    },
    makeRequest: function(query) {
        OAuth.popup('twitter', {cache: true}).done(function(result) {

            result.get('https://api.twitter.com/1.1/search/tweets.json?q='+query)
            .done(function (response) {
                console.log(response);
                twitter.displayTweets(response.statuses);
            })
            .fail(function (error) {
                console.log(error);
            });
        });
    },
    displayTweets: function(tweets) {
        // clear out container
        $('.tweet_container ul').empty();

        // iterate tweets, display some fields
        // display guidelines: https://dev.twitter.com/terms/display-requirements
        $.each(tweets, function(k,v) {
            var handle      = v['user']['screen_name'];
            var display_name= v['user']['name'];
            var profile_img = v['user']['profile_image_url_https'];
            var tweet_text  = v['text'];

            // use linkify to properly linkify
            var parsed_tweet_text = linkify(tweet_text);
            
            $('.tweet_container ul').append(
                '<li>'+
                '<img src="' +profile_img+ '" height="30px" width="30px" />'+
                '<span class="tweet_content">'+
                '<strong>' +display_name+ '</strong> ' +handle+ '<br />'+
                parsed_tweet_text+   '<br /><br />'+
                '</span></li>'
            );
        });

        // fix links to open in new browser and not in-app
        $.each( $('.tweet_container ul a') , function (i, el) {
            var current_link = $(el).attr('href');
            var new_onclick = 'window.open(\''+current_link+'\', \'_system\')';

            // set to new_onclick
            $(el).attr('onclick', new_onclick);

            // set to #
            $(el).attr('href', '#');
        });
    }
}

// https://www.goodreads.com/api
var goodreads = {
    initialize: function() {
    }
}
