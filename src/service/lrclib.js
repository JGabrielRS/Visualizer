
export const fetchLyrics = async (artist, title, URL) => {
    const params = new URLSearchParams({
        track_name: title,
        artist_name: artist
    });

    const requestURL = `${URL}/search?${params}`;

    console.log("Buscando:", requestURL);

    const response = await fetch(requestURL);

    console.log("Status:", response.status);

    if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();

    console.log("Resultados encontrados:", data);

    return data;
};
