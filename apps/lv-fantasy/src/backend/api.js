async function fetchLadderData() {
  const url =
    "https://backend-mls.fanhubmedia.com.au/mls_classic/api/classic_league/show_ladder?league_id=25349&order=rank&order_direction=ASC&sid=49754e941df51005538db81e0ca440869d05262e&_=1740451896531";

  const headers = {
    accept: "application/json, text/javascript, */*; q=0.01",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/x-www-form-urlencoded",
    priority: "u=1, i",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
  };

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: headers,
      referrer: "https://fantasy.mlssoccer.com/",
      referrerPolicy: "strict-origin-when-cross-origin",
      mode: "cors",
      credentials: "omit",
    });

    // Check if the response is ok (status in the range 200-299)
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Parse the JSON response
    const data = await response.json();
    return data; // Return the fetched data
  } catch (error) {
    console.error("Error fetching ladder data:", error);
    throw error; // Rethrow the error for further handling if needed
  }
}

// Example usage
fetchLadderData()
  .then((data) => {
    console.log("Ladder Data:", data);
  })
  .catch((error) => {
    console.error("Failed to fetch ladder data:", error);
  });
