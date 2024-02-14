import { Client, ClientArray, Room } from 'colyseus';
import { Schema, type, ArraySchema, MapSchema } from '@colyseus/schema';
import { log } from 'console';
import { nextTick } from 'process';

class Vec2 extends Schema {
  @type('number') x: number;
  @type('number') y: number;
}

class Player extends Schema {
  @type('string') userId: string;
  @type('string') name: string;
  @type(Vec2) position: Vec2;
}

class RoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();

  setPlayer(data: Player) {
    const player = new Player();
    player.userId = data.userId;
    player.name = data.name;
    player.position = new Vec2({ x: -90, y: 50 });
    this.players.set(player.userId, player);
    return player;
  }

  getPlayer(userId: string) {
    return this.players.get(userId);
  }

  removePlayer(userId: string) {
    this.players.delete(userId);
  }
}

export class GreenVillage extends Room<RoomState> {
  onCreate(options) {
    this.maxClients = 10;
    console.log(this.maxClients);
    console.log('created room green village', this.roomId);
    const roomState = new RoomState();
    this.setState(roomState);

    this.onMessage('startMove', (client, message) => {
      this.broadcast(
        'startMove',
        {
          way: message.way,
          userId: client.userData.userId,
        },
        { except: client },
      );
    });

    this.onMessage('endMove', (client, message) => {
      this.state.getPlayer(client.userData.userId).position = new Vec2(
        message.endPosition,
      );

      this.broadcast(
        'endMove',
        {
          way: message.way,
          endPosition: message.endPosition,
          userId: client.userData.userId,
        },
        {
          except: client,
        },
      );
    });
  }

  onJoin(client: Client, options) {
    console.log('onJoin', this.roomId);
    const token = options.token;
    const userId = options.userId;
    // check token...
    //

    const playerData = {
      userId: options.userId,
      name: this.randomName(),
    };

    client.userData = {
      userId: userId,
      playerData: JSON.stringify(playerData),
    };

    // client.send('gamedata', {
    //   success: true,
    //   data: {
    //     map: this.state.worldMap,
    //     config: {
    //       minStickLength: this.state.minStickLength,
    //       maxStickLength: this.state.maxStickLength,
    //       mapLength: this.state.mapLength,
    //     },
    //   },
    // });

    this.state.setPlayer(JSON.parse(client.userData.playerData) as Player);
  }

  onLeave(client: Client) {
    this.state.removePlayer(client.userData.userId);
  }

  randomString(length: number): string {
    const characters =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomString = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      const randomChar = characters.charAt(randomIndex);
      randomString += randomChar;
    }
    return randomString;
  }

  randomName() {
    const myArray = [
      'Trần Hạo Nam',
      'langtu_datinh123',
      'gay lord',
      'c0_b3_nG0k_199x',
      'nhok_trumzz',
      'chảo chống dính',
      'keo dính chuột',
      'Quái_Thú',
      'Cumming',
      'Mr.Peats',
      'sói đồng cỏ',
      'Chang_Kho_9x',
      'Ca sĩ Hàn Quốc',
      'MTP_TùngSơn',
      'Q_Kun_yellow',
      'traitimcodon',
      'ZzcongchuabongbongzZ',
    ];

    const randomIndex = Math.floor(Math.random() * myArray.length);
    return myArray[randomIndex];
  }
}
