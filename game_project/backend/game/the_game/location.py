import geoip2.database

def get_location(ip):
    reader = geoip2.database.Reader('/path/to/GeoLite2-City.mmdb')
    response = reader.city(ip)
    
    return response.country.name, response.city.name
