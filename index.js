const Twit = require('twit');
const axios = require('axios');
const config = require('./config');

const T = new Twit({
    consumer_key: config.twitter.consumer_key,
    consumer_secret: config.twitter.consumer_secret,
    access_token: config.twitter.access_token,
    access_token_secret: config.twitter.access_token_secret,
    strictSSL: true
});

async function postTweet(text, id = false) {
    const request = { status: text };

    if (id !== false) {
        request.in_reply_to_status_id = id;
    }

    try {
        const tweet = await T.post('statuses/update', request);
        console.log(`[${new Date().toJSON()}] tweeted ${tweet.data.id_str}: '${text}'`);

        return tweet.data.id_str;
    } catch (e) {
        throw e;
    }
};

const emoji = {
    'Bistro': '🍕🍝',
    'Mensa': '🍽️ '
};

(async () => {
    console.log('starting mensaplan-bot', new Date());

    try {
        const json = await axios.get(config.source);
        const day = json.data.weeks
            .map(week => week.days)
            .flat()
            .filter(day => day.date === new Date().toJSON().substr(0, 10));

        if (day.length === 1) {
            const today = day[0];
            const date = today.date.split('-');

            for (const [canteen, plan] of Object.entries(today)) {
                if (['Mensa', 'Bistro'].includes(canteen) && plan.open) {
                    try {
                        // begin thread for each canteen
                        let id = await postTweet(`${emoji[canteen]} Speiseplan #uulm #${canteen} am ${date[2]}.${date[1]}.${date[0]}`);
                        let tweet = '';

                        // try to fit the most meals in one tweet
                        for (const meal of plan.meals) {
                            const m = `${meal.category}: ${meal.meal.replace(/\( /g, '(')}\n`;
                            if (tweet.length + m.length < 280) {
                                tweet += m;
                            } else {
                                // next meal does not fit
                                id = await postTweet(tweet.trim(), id);
                                tweet = m;
                            }
                        }

                        // post remaining meals
                        if (tweet !== '') {
                            await postTweet(tweet.trim(), id);
                        }
                    } catch(e) {
                        console.error('Twit-Error:', e.statusCode, e.code, e.message);
                    }
                }
            }
        } else {
            console.log('closed?'); // todo error handling
        }
    } catch (e) {
        if (e.response) {
            console.error('HTTP-Error:', e.response.status, e.response.statusText);
        } else {
            console.error('UNKW-Error:', e);
        }
    }
})();
