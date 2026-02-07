/**
 * @name SpotifyTheme
 * @author Ambralin
 * @authorLink https://github.com/ambralin
 * @description Sets background colors based on current spotify song playing
 * @version 0.0.1
 */

module.exports = class SpotifyTheme {
    constructor(meta) {
        this.Webpack = BdApi.Webpack;
        this.presenceStore = BdApi.Webpack.getStore("SelfPresenceStore");
        this.onPresenceChange = this.onPresenceChange.bind(this);

        this.currentSong = "nulltimestamp";
    }

    start() {
        if (!this.presenceStore) return;
        this.presenceStore.addChangeListener(this.onPresenceChange);
        this.onPresenceChange();
    }

    stop() {
        if (!this.presenceStore) return;
        this.presenceStore.removeChangeListener(this.onPresenceChange);
        const ourstyle = document.head.querySelector(".mystyles");
        if (ourstyle) { ourstyle.remove(); }
    }

    onPresenceChange = () => {
        const presences = this.presenceStore.getActivities();

        const spotify = presences.find(a => a.name === "Spotify" && a.type === 2);
        if (spotify?.timestamps?.start && typeof spotify.timestamps.start === "string") {
            if(spotify["timestamps"]["start"].slice(0, -3) != this.currentSong) {
                this.currentSong = spotify["timestamps"]["start"].slice(0, -3);
                this.averageColorFromUrl(spotify["assets"]["large_image"].replace("spotify:", "https://i.scdn.co/image/")).then(color => {
                    console.log(`spotifyColor - ${spotify["details"]} | ${color}`);

                    const [r, g, b] = color;
                    const [h, s, l] = this.rgbToHsl(r, g, b);
                    const style = document.createElement("style");
                    style.classList = "mystyles";
                    style.textContent = `
                        .theme-darker {
                            --background-base-low: ${this.hslToCss(h, s, l * 0.5)} !important;
                            --background-base-lower: ${this.hslToCss(h, s, l * 0.3)} !important;
                            --background-base-lowest: ${this.hslToCss(h, s, l * 0.2)} !important;
                            --background-surface-high: ${this.hslToCss(h, s, l * 0.45)} !important;
                            --chat-background-default: ${this.hslToCss(h, s, l * 0.45)} !important;
                        }
                    `;
                    const laststyle = document.head.querySelector(".mystyles");
                    if (laststyle) { laststyle.remove(); }
                    document.head.appendChild(style);
                });
            }
        }
    };

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