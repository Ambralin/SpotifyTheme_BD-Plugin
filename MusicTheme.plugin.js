/**
 * @name MusicTheme
 * @author Ambralin & kaan
 * @authorLink https://github.com/ambralin
 * @description Sets background colors based on the current song playing (huge thanks to kaan for optimizing presence implementation)
 * @version 1.5.0
 * @donate paypal.me/dzelmanovic
 * @source https://github.com/Ambralin/MusicTheme_BD-Plugin/
 * @updateUrl https://github.com/Ambralin/MusicTheme_BD-Plugin/MusicTheme.plugin.js
 */

const {Webpack, Patcher, Utils} = new BdApi("MusicTheme")
const Dispatcher = Webpack.getByKeys("_dispatch", {searchExports: true})

const MusicStore = new class MS extends Utils.Store {
    #recentSong = {};

    setSong(song) { this.#recentSong = song; }
    didSongChange(newSong) { return newSong?.details !== this.#recentSong?.details; }
    getSong() { return this.#recentSong; }
}();

module.exports = class MusicTheme {
    start() {
        Dispatcher.subscribe('SELF_PRESENCE_STORE_UPDATE', this.onPresenceChange);
    }

    stop() {
        Dispatcher.unsubscribe('SELF_PRESENCE_STORE_UPDATE', this.onPresenceChange);
        BdApi.DOM.removeStyle("MusicTheme");
    }
    
    onPresenceChange = (dispatch) => {
        const activities = dispatch.activities;
        let activity = null;

        activities.forEach(checkedactivity => {
            if (checkedactivity.type == 2 && (checkedactivity.name == "YouTube Music" || checkedactivity.name == "Spotify")) 
                activity = checkedactivity;
        });

        if (!activity || !activity.assets?.large_image) {
            BdApi.DOM.removeStyle("MusicTheme");
            MusicStore.setSong({});
            return;
        }

        const didChange = MusicStore.didSongChange(activity);
        MusicStore.setSong(activity);
        if (!didChange) return;

        let imageUrl = "";
        if( activity.name === "Spotify" ) {
            imageUrl = activity.assets.large_image.replace("spotify:", "https://i.scdn.co/image/");
        } else {
            imageUrl = "https://" + activity.assets.large_image.split("/https/")[1];
        }
        if (!imageUrl || imageUrl === "https://undefined") return;

        console.log(`[MusicTheme] ${activity.details} by ${activity.state}`);

        this.vibrantColorFromUrl(imageUrl)
            .then(color => this.updateTheme(color))
            .catch(e => console.warn("[MusicTheme]", e));
    }

    updateTheme([r, g, b]) {
        const [h, s, l] = this.rgbToHsl(r, g, b);
        BdApi.DOM.addStyle("MusicTheme", `
            .theme-darker, .theme-darker * {
                transition: background-color 1000ms ease-out !important;
                --background-base-low:      ${this.hslToCss(h, s, l * 0.50)} !important;
                --background-base-lower:    ${this.hslToCss(h, s, l * 0.30)} !important;
                --background-base-lowest:   ${this.hslToCss(h, s, l * 0.20)} !important;
                --background-surface-high:  ${this.hslToCss(h, s, l * 0.45)} !important;
                --chat-background-default:  ${this.hslToCss(h, s, l * 0.45)} !important;
            }

            .theme-darker *:hover { transition: background-color 10ms ease-out !important;
        `);
    }

    async vibrantColorFromUrl(url, k = 4, maxIterations = 10, sampleSize = 5000) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;

        return new Promise((resolve, reject) => {
            img.onload = () => {

                const canvas = document.createElement("canvas");

                const scale = Math.min(1, Math.sqrt(sampleSize / (img.width * img.height)));
                canvas.width = Math.max(1, Math.floor(img.width * scale));
                canvas.height = Math.max(1, Math.floor(img.height * scale));

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

                const pixels = [];
                const skippedPixels = [];

                for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3];
                    if (a < 125) continue;

                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    const [, s, l] = this.rgbToHsl(r, g, b);

                    const lowSaturation = s < 25;
                    const badLightness = l < 15 || l > 85;

                    if (lowSaturation || badLightness) {
                        skippedPixels.push([r, g, b]);
                        continue;
                    }

                    pixels.push([r, g, b]);
                }

                if (!pixels.length && skippedPixels.length) {
                    pixels.push(...skippedPixels);
                }

                if (!pixels.length) {
                    reject(new Error("No usable pixels"));
                    return;
                }

                const centroids = [];
                for (let i = 0; i < k; i++) {
                    centroids.push(pixels[Math.floor(Math.random() * pixels.length)].slice());
                }

                let assignments = new Array(pixels.length);

                for (let iter = 0; iter < maxIterations; iter++) {

                    for (let i = 0; i < pixels.length; i++) {

                        let best = 0;
                        let minDist = Infinity;

                        for (let j = 0; j < k; j++) {
                            const dr = pixels[i][0] - centroids[j][0];
                            const dg = pixels[i][1] - centroids[j][1];
                            const db = pixels[i][2] - centroids[j][2];

                            const dist = dr*dr + dg*dg + db*db;

                            if (dist < minDist) {
                                minDist = dist;
                                best = j;
                            }
                        }

                        assignments[i] = best;
                    }

                    const sums = Array.from({ length: k }, () => [0,0,0,0]);

                    for (let i = 0; i < pixels.length; i++) {
                        const c = assignments[i];
                        sums[c][0] += pixels[i][0];
                        sums[c][1] += pixels[i][1];
                        sums[c][2] += pixels[i][2];
                        sums[c][3]++;
                    }

                    for (let j = 0; j < k; j++) {
                        if (!sums[j][3]) continue;
                        centroids[j][0] = sums[j][0] / sums[j][3];
                        centroids[j][1] = sums[j][1] / sums[j][3];
                        centroids[j][2] = sums[j][2] / sums[j][3];
                    }
                }

                const clusterStats = Array.from({ length: k }, () => ({
                    count: 0,
                    score: 0
                }));

                for (let i = 0; i < pixels.length; i++) {
                    const c = assignments[i];
                    const [h, s, l] = this.rgbToHsl(...pixels[i]);

                    clusterStats[c].count++;
                    clusterStats[c].score += s * 0.7 + l * 0.3;
                }

                let bestCluster = 0;
                let bestValue = -Infinity;

                for (let j = 0; j < k; j++) {
                    if (!clusterStats[j].count) continue;

                    const weighted =
                        (clusterStats[j].score / clusterStats[j].count) *
                        Math.log(clusterStats[j].count);

                    if (weighted > bestValue) {
                        bestValue = weighted;
                        bestCluster = j;
                    }
                }

                const [r, g, b] = centroids[bestCluster].map(v => Math.round(v));
                resolve([r, g, b]);
            };

            img.onerror = () => reject(new Error("Image load failed"));
        });
    }

    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h * 360, s * 100, l * 100];
    }

    hslToCss(h, s, l) {
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

};
