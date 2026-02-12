/**
 * @name MusicTheme
 * @author Ambralin
 * @authorLink https://github.com/ambralin
 * @description Sets background colors based on the current song playing
 * @version 1.4.0
 * @donate paypal.me/dzelmanovic
 * @source https://github.com/Ambralin/MusicTheme_BD-Plugin/
 * @updateUrl https://github.com/Ambralin/MusicTheme_BD-Plugin/MusicTheme.plugin.js
 */

module.exports = class MusicTheme {
    constructor(meta) {
        this.Webpack = BdApi.Webpack;
        this.presenceStore = BdApi.Webpack.getStore("SelfPresenceStore");
        this.onPresenceChange = this.onPresenceChange.bind(this);

        this.currentSong = "nulltimestamp";
    }

    getSettingsPanel() {
        const functionSwap = {
            id: "oldFunc",
            name: "Old Color Function",
            type: "switch",
            value: this.mySettings["oldFunc"]
        };

        return BdApi.UI.buildSettingsPanel({
            onChange: (_, id, value) => {
                this.mySettings[id] = value;
                BdApi.Data.save("MusicTheme", "settings", this.mySettings);
                this.onPresenceChange(true);
            },
            settings: [functionSwap]
        });
    }

    start() {
        const myDefaults = {
            oldFunc: false
        };

        this.mySettings = Object.assign({}, myDefaults, BdApi.Data.load("MusicTheme", "settings"));

        if (!this.presenceStore) return;
        this.presenceStore.addChangeListener(this.onPresenceChange);
        this.onPresenceChange(true);
    }

    stop() {
        if (!this.presenceStore) return;
        this.presenceStore.removeChangeListener(this.onPresenceChange);
        const ourstyle = document.head.querySelector(".mystyles");
        if (ourstyle) { ourstyle.remove(); }
    }

    onPresenceChange = (forcechange) => {
        const presences = this.presenceStore.getActivities();

        const songpresence = presences.find(a => (a.name === "Spotify" || a.name === "YouTube Music") && a.type === 2);
        if (songpresence?.timestamps?.start && typeof songpresence.timestamps.start === "string") {
            if(songpresence["timestamps"]["start"].slice(0, -3) != this.currentSong || forcechange) {
                this.currentSong = songpresence["timestamps"]["start"].slice(0, -3);
                let imageUrl = "";
                if( songpresence["name"] === "Spotify" ) {
                    imageUrl = songpresence["assets"]["large_image"].replace("spotify:", "https://i.scdn.co/image/");
                } else {
                    imageUrl = "https://" + songpresence["assets"]["large_image"].split("/https/")[1];
                }
                console.log(`musictheme | ${songpresence["details"]}`);
                if(this.mySettings["oldFunc"]) {
                    this.averageColorFromUrl(imageUrl).then(color => {this.updateTheme(color)});
                } else {
                    this.vibrantColorFromUrl(imageUrl).then(color => {this.updateTheme(color)});
                }
            }
        } else {
            const removestyle = document.head.querySelector(".mystyles");
            if (removestyle) { removestyle.remove(); }
        }
    };

    updateTheme(newColor) {
        console.log(newColor);
        const [r, g, b] = newColor;
        const [h, s, l] = this.rgbToHsl(r, g, b);
        const style = document.createElement("style");
        style.classList = "mystyles";
        style.textContent = `
            .theme-darker, .theme-darker * {
                transition: background-color 1000ms ease-out !important;
                --background-base-low: ${this.hslToCss(h, s, l * 0.5)} !important;
                --background-base-lower: ${this.hslToCss(h, s, l * 0.3)} !important;
                --background-base-lowest: ${this.hslToCss(h, s, l * 0.2)} !important;
                --background-surface-high: ${this.hslToCss(h, s, l * 0.45)} !important;
                --chat-background-default: ${this.hslToCss(h, s, l * 0.45)} !important;
            }

            .theme-darker *:hover {
                transition: background-color 10ms ease-out !important;
            }
        `;
        const laststyle = document.head.querySelector(".mystyles");
        if (laststyle) { laststyle.remove(); }
        document.head.appendChild(style);
    }

    async averageColorFromUrl(url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;

        return new Promise((resolve, reject) => {
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                let r = 0, g = 0, b = 0;
                const pixels = data.length / 4;

                for (let i = 0; i < data.length; i += 4) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                }

                r = Math.round(r / pixels);
                g = Math.round(g / pixels);
                b = Math.round(b / pixels);

                resolve([r, g, b]);
            };

            img.onerror = () => reject(new Error("Image load failed"));
        });
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



    async accentColorFromUrl(url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;

        return new Promise((resolve, reject) => {
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

                let r = 0, g = 0, b = 0, count = 0;
                let rSkipped = 0, gSkipped = 0, bSkipped = 0, countSkipped = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const rr = data[i];
                    const gg = data[i + 1];
                    const bb = data[i + 2];

                    const [_, s, l] = this.rgbToHsl(rr, gg, bb);

                    if (s < 15) {
                        rSkipped += rr;
                        gSkipped += gg;
                        bSkipped += bb;
                        countSkipped++;
                        continue;
                    }
                    if (l < 20 || l > 80) {
                        rSkipped += rr;
                        gSkipped += gg;
                        bSkipped += bb;
                        countSkipped++;
                        continue;
                    }

                    r += rr;
                    g += gg;
                    b += bb;
                    count++;
                }

                // If the valid pixel count is too small (<5% of all pixels), fallback to all pixels
                const totalPixels = data.length / 4;
                if (countSkipped < totalPixels * 0.3) {
                    r += rSkipped;
                    g += gSkipped;
                    b += bSkipped;
                    count += countSkipped;
                }

                if (count === 0) {
                    resolve([0, 0, 0]);
                    return;
                }

                resolve([
                    Math.round(r / count),
                    Math.round(g / count),
                    Math.round(b / count)
                ]);
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
