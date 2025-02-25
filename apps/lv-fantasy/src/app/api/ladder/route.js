import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(
    "https://backend-mls.fanhubmedia.com.au/mls_classic/api/classic_league/show_ladder?league_id=25349&order=rank&order_direction=ASC&sid=49754e941df51005538db81e0ca440869d05262e&_=1740451896531"
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: res.status }
    );
  }

  const data = await res.json();

  // Sort the data by rank in ascending order
  const sortedData = data.result.sort((a, b) => a.rank - b.rank);

  return NextResponse.json(sortedData);
}
