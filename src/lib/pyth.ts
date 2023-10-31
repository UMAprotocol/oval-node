import axios from "axios";

const apiUrl = "https://hermes.pyth.network/api/get_price_feed";

export async function fetchPythData(id: string, timestamp: number) {
  const endpoint = `${apiUrl}?id=${id}&publish_time=${timestamp}&verbose=false&binary=true`;

  try {
    const response = await axios.get(endpoint);
    return response.data;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}
