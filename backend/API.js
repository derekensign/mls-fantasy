import axios from "axios";

const BASE_URL = "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod";

export const fetchGoldenBootTable = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/golden-boot-table`);
    console.log("resopnse", response);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return [];
  }
};
