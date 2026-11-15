export type Purpose = "work" | "leisure";

export type TravelLink = { name: string; url: string; note: string };

/**
 * Deep links into travel sites with the city and dates filled in.
 * `to` is the day you leave, so it's the checkout date.
 */
export function stayLinks(city: string, from: string, to: string, purpose: Purpose) {
  const q = encodeURIComponent(city);
  const checkout = to > from ? to : nextDay(from);

  const airbnb: TravelLink = {
    name: "Airbnb",
    url: `https://www.airbnb.com/s/${q}/homes?checkin=${from}&checkout=${checkout}&adults=1`,
    note: "Whole homes and apartments in real neighborhoods",
  };
  const vrbo: TravelLink = {
    name: "Vrbo",
    url: `https://www.vrbo.com/search?destination=${q}&startDate=${from}&endDate=${checkout}&adults=1`,
    note: "Vacation rentals, often bigger places",
  };
  const booking: TravelLink = {
    name: "Booking.com",
    url: `https://www.booking.com/searchresults.html?ss=${q}&checkin=${from}&checkout=${checkout}&group_adults=1&no_rooms=1`,
    note: "Hotels with free cancellation filters",
  };
  const googleHotels: TravelLink = {
    name: "Google Hotels",
    url: `https://www.google.com/travel/search?q=${encodeURIComponent(`hotels in ${city}`)}`,
    note: "Compares prices across hotel sites on a map (set your dates there)",
  };

  return purpose === "work"
    ? {
        best: googleHotels,
        why: "For work trips, a hotel near where you'll be is easiest. Google Hotels compares every booking site on one map.",
        others: [booking, airbnb, vrbo],
      }
    : {
        best: airbnb,
        why: "For leisure, a place in a walkable neighborhood lets you live like a local.",
        others: [vrbo, googleHotels, booking],
      };
}

export function flightLink(home: string, city: string, from: string, to: string) {
  if (!home) return null;
  const q = `Flights from ${home} to ${city} on ${from} through ${to}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
