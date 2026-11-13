export function parseLrc(lrc) {
    return lrc
        .split("\n")
        .flatMap((line) => {
            const matches = [...line.matchAll(/\[(\d{2}):(\d{2}\.\d{2,3})\]/g)];

            if (matches.length === 0) return [];

            const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim();

            return matches.map((match) => ({
                time: Number(match[1]) * 60 + Number(match[2]),
                text,
            }));
        })
        .sort((a, b) => a.time - b.time);
}