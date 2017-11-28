import { Injectable } from '@angular/core';

import { Observable } from 'rxjs/Observable';
import { of } from 'rxjs/observable/of';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/take';

import { Action, Store } from '@ngrx/store';
import { Actions, Effect } from '@ngrx/effects';

import * as HeroActions from './hero.action';
import { Hero } from '../model';
import { HeroDataService } from './hero-data.service';
import { State } from './reducers';

@Injectable()
export class HeroEffects {
  @Effect()
  getHeroes$: Observable<Action> = this.actions$
    .ofType(HeroActions.GET_HEROES)
    .switchMap(() => this.store.select(state => state.hero).take(1))
    .switchMap(heroState => {
      const heroes = heroState.heroes;
      if (!heroes || heroes.length === 0) {
        return this.heroDataService.getHeroes('');
      }
      return of(heroes);
    })
    // .switchMap(heroState => {
    //   const heroes = heroState.heroes;
    //   if (!heroes || heroes.length === 0) {
    //     return this.heroDataService.getHeroes(heroState.searchCriteria);
    //   }
    //   return of(heroes.filter(h => new RegExp(heroState.searchCriteria, 'i').test(h.name)));
    // })
    .map(results => new HeroActions.GetHeroesSuccess(results))
    .catch(() => of(new HeroActions.GetHeroError()));

  @Effect()
  createHero$: Observable<Action> = this.actions$
    .ofType(HeroActions.ADD_HERO)
    .map((action: HeroActions.AddHero) => action.payload)
    .switchMap(hero => this.heroDataService.addHero(hero))
    .map((hero: Hero) => new HeroActions.AddHeroSuccess(hero))
    .catch((hero: Hero) => of(new HeroActions.AddHeroError()));

  @Effect()
  deleteHero$: Observable<Action> = this.actions$
    .ofType(HeroActions.DELETE_HERO)
    .map((action: HeroActions.DeleteHero) => action.payload)
    .switchMap(hero => this.heroDataService.deleteHero(hero))
    .map((hero: Hero) => new HeroActions.DeleteHeroSuccess(hero))
    .catch((hero: Hero) => of(new HeroActions.DeleteHeroError(hero)));

  @Effect()
  updateHero$: Observable<Action> = this.actions$
    .ofType(HeroActions.UPDATE_HERO)
    .map((action: HeroActions.UpdateHero) => action.payload)
    .switchMap(hero => this.heroDataService.updateHero(hero))
    .map((hero: Hero) => new HeroActions.UpdateHeroSuccess(hero))
    .catch((hero: Hero) => of(new HeroActions.UpdateHeroError(hero)));

  constructor(
    private store: Store<State>,
    private actions$: Actions,
    private heroDataService: HeroDataService
  ) {}
}
