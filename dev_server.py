from Server.server import HorusServer

server = HorusServer(debug=True, desktop=False)

server.run(reloader=True)