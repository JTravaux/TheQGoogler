const EventSource = require('eventsource');
const axios = require('axios');
const Chromium = require('puppeteer');

let stop = ["typically", "what", "is", "a", "the", "where", "in", "does", "has", "of", "these", "an"]
let gameType = '';

// Remove the stop words
removeStopWords = text => {
    text = text.toLowerCase();
    let strs = text.split(" ");

    for (let i = 0; i < stop.length; ++i)
        if (strs.indexOf(stop[i]) > -1)
            strs = strs.filter(s => s !== stop[i])

    let removed = strs.join(" ");

    if (removed.indexOf('?') > -1)
        removed = removed.replace('?', '');

    return removed;
}

async function run() {
    try {

        // TheQ Authorization Token (API Key basically)
        let token = 'Bearer ************************************************';

        // Get the current/next game ID
        let games = await axios.get(`https://api.us.theq.live/v2/games?gameTypes=TRIVIA,POPULAR&includeSubscriberOnly=1`);

        // Check the game is active and proceed
        if(games.data.games[0].active) {
            let gameID = games.data.games[0].id;
            gameType = games.data.games[0].gameType; // TRIVIA or POPULAR

            // Connect to the event feed
            const eventSource = new EventSource(`https://long-term-beds.us.theq.live/v2/event-feed/games/${gameID}`, { headers: { 'Authorization': token } });
            
            // Configure Event handlers
            if(gameType === 'TRIVIA') {
                eventSource.onopen = () => console.log('Connected to trivia game. Waiting for question...');
                eventSource.addEventListener('QuestionStart', SearchGoogle);
                eventSource.addEventListener('QuestionStart', OpenInGoogle);
            } else {
                eventSource.onopen = () => console.log('Connected to ITK game. Waiting for question...');
                eventSource.addEventListener('QuestionStart', OpenInGoogle);
            }

        } else {
            console.log("\x1b[31m\nNo Active Game...\x1b[0m")
            let nextGame = new Date(games.data.games[0].scheduled);
            console.log(`\x1b[33mNext Game: ${games.data.games[0].gameType} on ${nextGame.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${nextGame.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit'})}\x1b[0m\n`)
        }

        //OpenInGoogle('{ "data": { "id": 1556142776005, "gameId": "0abc0fb7-ebc1-4b73-a560-af24958f4eab", "questionId": "83270680-66d9-11e9-bbd9-9767689f76aa", "questionType": "TRIVIA", "categoryId": "2cfa4ff4-8ecc-4d21-81cc-a61facd640f3", "question": "In which state can you visit the Crazy Horse Memorial?", "choices": [{ "id": "83270681-66d9-11e9-bbd9-9767689f76aa", "questionId": "83270680-66d9-11e9-bbd9-9767689f76aa", "choice": "Montana" }, { "id": "83270682-66d9-11e9-bbd9-9767689f76aa", "questionId": "83270680-66d9-11e9-bbd9-9767689f76aa", "choice": "Oregon" }, { "id": "83270683-66d9-11e9-bbd9-9767689f76aa", "questionId": "83270680-66d9-11e9-bbd9-9767689f76aa", "choice": "South Dakota" }], "secondsToRespond": 8, "number": 9, "total": 12 } }')
        //SearchGoogle({ "data": { "id": 1556142776005, "gameId": "0abc0fb7-ebc1-4b73-a560-af24958f4eab", "questionId": "83270680-66d9-11e9-bbd9-9767689f76aa", "questionType": "TRIVIA", "categoryId": "2cfa4ff4-8ecc-4d21-81cc-a61facd640f3", "question": "In which state can you visit the Crazy Horse Memorial?", "choices": [{ "id": "83270681-66d9-11e9-bbd9-9767689f76aa", "questionId": "83270680-66d9-11e9-bbd9-9767689f76aa", "choice": "Montana" }, { "id": "83270682-66d9-11e9-bbd9-9767689f76aa", "questionId": "83270680-66d9-11e9-bbd9-9767689f76aa", "choice": "Oregon" }, { "id": "83270683-66d9-11e9-bbd9-9767689f76aa", "questionId": "83270680-66d9-11e9-bbd9-9767689f76aa", "choice": "South Dakota" }], "secondsToRespond": 8, "number": 9, "total": 12 } })

    } catch (err) {
        console.log(err);
    }
}

// Google
searchGoogle = (q, answer, window) => {
    return new Promise(resolve => {
        window.newPage().then((tab) => {
            tab.goto('https://www.google.com/ncr').then(() => {
                tab.type('#tsf', q).then(() => {
                    tab.keyboard.press('Enter').then(() => {
                        tab.waitForNavigation().then(() => {
                            tab.$("#resultStats").then((el) => {
                                el.getProperty('textContent').then((js) => {
                                    js.jsonValue().then((x) => {
                                        tab.$("#ires").then((el) => {
                                            el.getProperty('textContent').then((js) => {
                                                js.jsonValue().then((x1) => {
                                                    let snippet = false;
                                                    let numResults;

                                                    if (x1.startsWith('Featured snippet from the web')) 
                                                        snippet = true;

                                                    if (x.indexOf('About') > -1)
                                                        numResults = Number(x.split(' ')[1].replace(/,/g, ''));
                                                    else
                                                        numResults = Number(x.split(' ')[0].replace(/,/g, ''));
                                                    
                                                    resolve({ answer, engine: 'Google', results: numResults, snippet: snippet })
                                                })
                                            })
                                        })
                                    })
                                })
                            })
                        })
                    })
                })
            })
        })
    })
}

// Bing
searchBing = (q, answer, window) => {
    return new Promise(resolve => {
        window.newPage().then(tab => {
            tab.goto('https://www.bing.com').then(() => {
                tab.type('#sb_form_q', q).then(() => {
                    tab.keyboard.press('Enter').then(() => {
                        tab.waitForNavigation().then(() => {
                            tab.$("#b_tween").then(el => {
                                if (!el)
                                    return;
                                el.getProperty('textContent').then(js => {
                                    js.jsonValue().then((x) => {
                                        if (x.indexOf('About') > -1)
                                            numResults = Number(x.split(' ')[1].replace(/,/g, ''));
                                        else
                                            numResults = Number(x.split(' ')[0].replace(/,/g, ''));

                                        resolve({ answer, engine: 'Bing', results: numResults });
                                    })
                                })
                            })
                        })
                    })
                })
            })
        })
    })
}

OpenInGoogle = msg => {
    let jsonMsg = JSON.parse(msg.data);
    let question = jsonMsg.question;
    let url = `https://google.com/search?q=${question}`

    if(gameType === 'TRIVIA') {
        Chromium.launch({ headless: false, defaultViewport: null }).then((window) => {
            window.newPage().then((tab) => tab.goto(url))
        })

    } else {
        Chromium.launch({ headless: false, defaultViewport: null }).then((window) => {
            window.newPage().then((tab) => tab.goto(url))
        })
    }
  
}

SearchGoogle = async msg => {
    let jsonMsg = JSON.parse(msg.data);

    let question = removeStopWords(jsonMsg.question);
    let window = await Chromium.launch({ headless: true, defaultViewport: null, pipe: true })
    let answers = jsonMsg.choices;
    let newResults = [];
    let el;

    console.log(`\x1b[35m\n${question}\x1b[0m`);
    
    let results = await Promise.all([
        searchGoogle(`${question} + "${answers[0].choice}"`, answers[0].choice, window),
        searchGoogle(`${question} + "${answers[1].choice}"`, answers[1].choice, window),
        searchGoogle(`${question} + "${answers[2].choice}"`, answers[2].choice, window),
        searchBing(`${question} + "${answers[0].choice}"`, answers[0].choice, window),
        searchBing(`${question} + "${answers[1].choice}"`, answers[1].choice, window),
        searchBing(`${question} + "${answers[2].choice}"`, answers[2].choice, window)
    ]);

    // Condense
    for (let i = 0; i < results.length; ++i) {
        if (results[i].engine === 'Google')
            el = results[i];

        if (newResults.length === 3)
            break;

        for (let j = 0; j < results.length; ++j) {
            if (el === results[j])
                continue;

            if (el.answer === results[j].answer)
                newResults.push({ Answer: el.answer, 'Google Results': el.results, 'Google Snippet': el.snippet, 'Bing Results': results[j].results })
        }
    }

    newResults.sort((res1, res2) => { return res1['Google Results'] > res2['Google Results'] ? -1 : 1; });
    newResults.sort((res1, res2) => { return res2['Google Snippet'] - res1['Google Snippet'] });
    console.table(newResults);
}

run();